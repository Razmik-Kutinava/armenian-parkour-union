import { describe, expect, it } from 'vitest';
import type { LocalsUser, UserRole } from '../auth/session';
import { adminNav } from './nav';

const user = (role: UserRole): LocalsUser => ({
	id: 'u1',
	email: 'u@example.com',
	name: 'U',
	emailVerified: true,
	role,
	locale: 'en',
	level: null
});

const hrefs = (role: UserRole) => adminNav(user(role)).flatMap((g) => g.items.map((i) => i.href));
const groups = (role: UserRole) => adminNav(user(role)).map((g) => g.key);

/* docs/05 section 2 filtered by the matrix of docs/04 section 5.1. */
describe('adminNav', () => {
	it('editor: dashboard and content, plus shop items', () => {
		expect(hrefs('editor')).toEqual([
			'/admin',
			'/admin/hero',
			'/admin/news',
			'/admin/pages',
			'/admin/events',
			'/admin/media',
			'/admin/products'
		]);
		expect(groups('editor')).toEqual(['admin.group.overview', 'admin.group.content', 'admin.group.shop']);
	});

	it('moderator: dashboard, members, moderation, points and orders', () => {
		expect(hrefs('moderator')).toEqual([
			'/admin',
			'/admin/users',
			'/admin/exams',
			'/admin/certificates',
			'/admin/consents',
			'/admin/videos',
			'/admin/registrations',
			'/admin/points',
			'/admin/orders'
		]);
	});

	it('admin: every section, system group last', () => {
		const all = hrefs('admin');
		expect(all).toHaveLength(22);
		expect(all.slice(-3)).toEqual(['/admin/settings', '/admin/audit', '/admin/roles']);
		expect(groups('admin')).toEqual([
			'admin.group.overview',
			'admin.group.content',
			'admin.group.members',
			'admin.group.moderation',
			'admin.group.shop',
			'admin.group.money',
			'admin.group.system'
		]);
	});

	it('no section of money or system for non-admins', () => {
		for (const role of ['editor', 'moderator'] as const) {
			expect(hrefs(role).some((h) => /payments|donation|settings|audit|roles/.test(h))).toBe(false);
		}
	});

	it('member gets an empty menu', () => {
		expect(adminNav(user('member'))).toEqual([]);
	});
});
