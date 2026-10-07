import { describe, expect, it } from 'vitest';
import { blockError, canManageUser, roleChangeError } from './role-rules';

const admin = { id: 'a1', role: 'admin' as const };
const target = (role: 'member' | 'editor' | 'moderator' | 'admin', id = 't1') => ({
	id,
	role,
	status: 'active' as const
});

describe('roleChangeError (docs/04 section 6.2–6.3)', () => {
	it('lets an admin change another user role', () => {
		expect(roleChangeError(admin, target('member'), 'editor', 1)).toBeNull();
		expect(roleChangeError(admin, target('admin'), 'moderator', 2)).toBeNull();
	});

	it('only an admin assigns roles', () => {
		for (const role of ['member', 'editor', 'moderator'] as const) {
			expect(roleChangeError({ id: 'x', role }, target('member'), 'editor', 1)).toBe('not_admin');
		}
	});

	it('nobody changes their own role', () => {
		expect(roleChangeError(admin, target('admin', 'a1'), 'member', 3)).toBe('self');
	});

	it('the last active admin cannot be demoted', () => {
		expect(roleChangeError(admin, target('admin'), 'member', 1)).toBe('last_admin');
		expect(roleChangeError(admin, target('admin'), 'admin', 1)).toBeNull();
	});
});

describe('blockError (docs/04 section 6.3–6.4)', () => {
	it('lets an admin block another user', () => {
		expect(blockError(admin, target('member'), 1)).toBeNull();
		expect(blockError(admin, target('admin'), 2)).toBeNull();
	});

	it('only an admin blocks, never themselves, never the last active admin', () => {
		expect(blockError({ id: 'm', role: 'moderator' }, target('member'), 1)).toBe('not_admin');
		expect(blockError(admin, target('admin', 'a1'), 3)).toBe('self');
		expect(blockError(admin, target('admin'), 1)).toBe('last_admin');
	});

	it('a blocked admin is not counted as the one to protect', () => {
		expect(blockError(admin, { id: 't1', role: 'admin', status: 'blocked' }, 1)).toBeNull();
	});
});

describe('canManageUser (docs/04 section 6.5)', () => {
	it('moderator and editor only reach member accounts (no order between them in docs/04)', () => {
		expect(canManageUser({ role: 'moderator' }, 'member')).toBe(true);
		expect(canManageUser({ role: 'moderator' }, 'editor')).toBe(false);
		expect(canManageUser({ role: 'editor' }, 'moderator')).toBe(false);
		expect(canManageUser({ role: 'moderator' }, 'moderator')).toBe(false);
		expect(canManageUser({ role: 'moderator' }, 'admin')).toBe(false);
		expect(canManageUser({ role: 'editor' }, 'editor')).toBe(false);
		expect(canManageUser({ role: 'member' }, 'member')).toBe(false);
	});

	it('admin reaches every account', () => {
		for (const role of ['member', 'editor', 'moderator', 'admin'] as const) {
			expect(canManageUser({ role: 'admin' }, role)).toBe(true);
		}
	});
});
