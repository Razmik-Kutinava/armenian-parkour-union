import { describe, expect, it } from 'vitest';
import { breadcrumbs } from './breadcrumbs';

const nav = [
	{ key: 'admin.group.overview', items: [{ key: 'admin.nav.dashboard', href: '/admin', icon: 'dashboard' }] },
	{
		key: 'admin.group.content',
		items: [
			{ key: 'admin.nav.news', href: '/admin/news', icon: 'news' },
			{ key: 'admin.nav.pages', href: '/admin/pages', icon: 'pages' }
		]
	}
] as const;

describe('breadcrumbs', () => {
	it('dashboard is just the admin root', () => {
		expect(breadcrumbs(nav, '/admin')).toEqual([{ key: 'admin.title', href: '/admin' }]);
	});

	it('a section and its sub-pages add the section crumb', () => {
		const crumbs = [
			{ key: 'admin.title', href: '/admin' },
			{ key: 'admin.nav.news', href: '/admin/news' }
		];
		expect(breadcrumbs(nav, '/admin/news')).toEqual(crumbs);
		expect(breadcrumbs(nav, '/admin/news/42/edit')).toEqual(crumbs);
	});

	it('does not match a section by a shared prefix only', () => {
		expect(breadcrumbs(nav, '/admin/newsletter')).toEqual([{ key: 'admin.title', href: '/admin' }]);
	});
});
