import { describe, expect, it } from 'vitest';
import { userRole } from '#lib/server/db/schema/enums.ts';
import { blockSchema, createUserSchema, profileSchema, roleSchema, roles } from './admin-users';

const TODAY = new Date('2026-10-07T12:00:00Z');
const adult = { firstName: ' Ani ', lastName: 'Petrosyan', birthDate: '1995-03-03' };

describe('admin user forms', () => {
	it('roles match the database enum', () => {
		expect([...roles]).toEqual(userRole.enumValues);
	});

	it('profile: names trimmed, empty optional fields dropped', () => {
		const r = profileSchema(TODAY).safeParse({ ...adult, phone: '', city: ' Gyumri ' });
		expect(r.success && r.data).toEqual({
			firstName: 'Ani',
			lastName: 'Petrosyan',
			birthDate: '1995-03-03',
			city: 'Gyumri'
		});
	});

	it('profile: a minor needs parent data', () => {
		const r = profileSchema(TODAY).safeParse({ ...adult, birthDate: '2015-01-01' });
		expect(r.success).toBe(false);
		const paths = r.error?.issues.map((i) => i.path[0]);
		expect(paths).toEqual(
			expect.arrayContaining(['guardianName', 'guardianPhone', 'guardianEmail'])
		);
	});

	it('create: email required and lower-cased', () => {
		expect(createUserSchema(TODAY).safeParse(adult).success).toBe(false);
		const r = createUserSchema(TODAY).safeParse({ ...adult, email: ' Ani@Example.com ' });
		expect(r.success && r.data.email).toBe('ani@example.com');
	});

	it('role: only known roles', () => {
		expect(roleSchema.safeParse({ role: 'editor' }).success).toBe(true);
		expect(roleSchema.safeParse({ role: 'root' }).success).toBe(false);
	});

	it('block: a reason is required, at most 500 characters', () => {
		expect(blockSchema.safeParse({ reason: '  ' }).success).toBe(false);
		expect(blockSchema.safeParse({ reason: 'x'.repeat(501) }).success).toBe(false);
		expect(blockSchema.safeParse({ reason: ' Spam ' }).data).toEqual({ reason: 'Spam' });
	});
});
