import { describe, expect, it } from 'vitest';
import { toLocalsUser } from './session';

const base = {
	id: '7c1f6c1e-0000-4000-8000-000000000001',
	email: 'ani@example.com',
	name: 'Ani Petrosyan',
	emailVerified: true,
	role: 'editor',
	status: 'active',
	deletedAt: null,
	locale: 'hy',
	level: null
};

describe('toLocalsUser', () => {
	it('keeps only what pages need for an active user', () => {
		expect(toLocalsUser(base)).toEqual({
			id: base.id,
			email: 'ani@example.com',
			name: 'Ani Petrosyan',
			emailVerified: true,
			role: 'editor',
			locale: 'hy',
			level: null
		});
	});

	it('treats a blocked or deleted user as a guest (docs/04 section 5.2)', () => {
		expect(toLocalsUser({ ...base, status: 'blocked' })).toBeNull();
		expect(toLocalsUser({ ...base, deletedAt: new Date('2026-10-01') })).toBeNull();
	});

	it('is a guest when there is no session or the role or status is unknown', () => {
		expect(toLocalsUser(null)).toBeNull();
		expect(toLocalsUser(undefined)).toBeNull();
		expect(toLocalsUser({ ...base, role: 'superadmin' })).toBeNull();
		expect(toLocalsUser({ ...base, status: undefined })).toBeNull();
	});

	it('falls back to the default locale for an unknown one', () => {
		expect(toLocalsUser({ ...base, locale: 'de' })?.locale).toBe('en');
	});
});
