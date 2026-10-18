import { describe, expect, it } from 'vitest';
import { completeProfileSchema } from './profile';

const today = new Date('2026-10-18T12:00:00Z');
const adult = { firstName: 'Ani', lastName: 'Petrosyan', birthDate: '1995-04-20', terms: 'on' };
const guardian = {
	guardianName: 'Parent Name',
	guardianPhone: '+374 91 123456',
	guardianEmail: 'parent@example.com'
};

describe('completeProfileSchema (docs/06 section 4.11 for a Google account)', () => {
	it('adult: names, birth date and consent are enough', () => {
		const parsed = completeProfileSchema(today).safeParse(adult);
		expect(parsed.success).toBe(true);
		if (parsed.success) expect(parsed.data.terms).toBe(true);
	});

	it('requires consent', () => {
		const parsed = completeProfileSchema(today).safeParse({ ...adult, terms: undefined });
		expect(parsed.success).toBe(false);
		if (!parsed.success) expect(parsed.error.issues[0].path).toEqual(['terms']);
	});

	it('requires first and last name and a real birth date', () => {
		const parsed = completeProfileSchema(today).safeParse({
			terms: 'on',
			firstName: ' ',
			lastName: '',
			birthDate: '2026-02-30'
		});
		expect(parsed.success).toBe(false);
		if (!parsed.success) {
			const paths = parsed.error.issues.map((i) => i.path[0]);
			expect(paths).toEqual(expect.arrayContaining(['firstName', 'lastName', 'birthDate']));
		}
	});

	it('under 18: parent data is required (docs/03 section 13)', () => {
		const minor = { ...adult, birthDate: '2012-06-01' };
		const missing = completeProfileSchema(today).safeParse(minor);
		expect(missing.success).toBe(false);
		if (!missing.success) {
			const paths = missing.error.issues.map((i) => i.path[0]);
			expect(paths).toEqual(['guardianName', 'guardianPhone', 'guardianEmail']);
		}
		expect(completeProfileSchema(today).safeParse({ ...minor, ...guardian }).success).toBe(true);
	});

	it('does not accept email or password from the form', () => {
		const parsed = completeProfileSchema(today).safeParse({
			...adult,
			email: 'other@example.com',
			password: 'x'
		});
		expect(parsed.success && 'email' in parsed.data).toBe(false);
	});
});
