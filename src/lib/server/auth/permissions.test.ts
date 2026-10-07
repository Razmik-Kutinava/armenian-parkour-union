import { describe, expect, it } from 'vitest';
import { can, isStaff, permissions, type Permission } from './permissions';
import type { LocalsUser, UserRole } from './session';

/* docs/04-ROLES-PERMISSIONS.md section 5.1, row by row. */
const expected: Record<string, UserRole[]> = {
	'users.read_limited': ['moderator', 'admin'],
	'users.read_full': ['admin'],
	'users.write': ['admin'],
	'users.block': ['admin'],
	'users.set_level': ['admin'],
	'users.set_role': ['admin'],
	'events.write': ['editor', 'admin'],
	'events.cancel': ['admin'],
	'registrations.read': ['moderator', 'admin'],
	'registrations.manage': ['moderator', 'admin'],
	'exams.manage': ['moderator', 'admin'],
	'certificates.read': ['moderator', 'admin'],
	'certificates.issue': ['admin'],
	'certificates.revoke': ['admin'],
	'staff_profiles.write': ['admin'],
	'points.read': ['moderator', 'admin'],
	'points.adjust': ['admin'],
	'points.rules': ['admin'],
	'videos.moderate': ['moderator', 'admin'],
	'consents.review': ['moderator', 'admin'],
	'payments.read': ['admin'],
	'payments.manage': ['admin'],
	'donations.config': ['admin'],
	'shop.items_write': ['editor', 'admin'],
	'shop.orders_manage': ['moderator', 'admin'],
	'shop.orders_cancel': ['admin'],
	'posts.write': ['editor', 'admin'],
	'pages.write': ['editor', 'admin'],
	'hero.write': ['editor', 'admin'],
	'media.write': ['editor', 'admin'],
	'settings.write': ['admin'],
	'audit.read': ['admin']
};

const user = (role: UserRole): LocalsUser => ({
	id: `id-${role}`,
	email: `${role}@example.com`,
	name: role,
	emailVerified: true,
	role,
	locale: 'en',
	level: null
});

describe('permissions matrix', () => {
	it('matches docs/04 section 5.1 exactly', () => {
		expect(Object.keys(permissions).sort()).toEqual(Object.keys(expected).sort());
		for (const [code, roles] of Object.entries(expected)) {
			for (const role of ['member', 'editor', 'moderator', 'admin'] as const) {
				expect(can(user(role), code as Permission), `${role} ${code}`).toBe(roles.includes(role));
			}
		}
	});

	it('gives a guest nothing and a member no admin permission', () => {
		for (const code of Object.keys(expected) as Permission[]) {
			expect(can(null, code)).toBe(false);
			expect(can(user('member'), code)).toBe(false);
		}
	});

	it('editor cannot open users, payments or points (docs/04 section 8)', () => {
		const editor = user('editor');
		for (const code of ['users.read_limited', 'payments.read', 'points.read'] as const) {
			expect(can(editor, code)).toBe(false);
		}
	});

	it('moderator cannot adjust points or issue certificates (docs/04 section 8)', () => {
		expect(can(user('moderator'), 'points.adjust')).toBe(false);
		expect(can(user('moderator'), 'certificates.issue')).toBe(false);
	});

	it('only editor, moderator and admin are staff', () => {
		expect(isStaff(null)).toBe(false);
		expect(isStaff(user('member'))).toBe(false);
		expect(['editor', 'moderator', 'admin'].every((r) => isStaff(user(r as UserRole)))).toBe(true);
	});
});
