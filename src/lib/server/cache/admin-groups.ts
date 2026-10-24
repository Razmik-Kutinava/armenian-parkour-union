import type { CacheGroup } from './memory';

export const ALL_GROUPS: CacheGroup[] = ['settings', 'pages', 'posts', 'events', 'hero', 'staff'];

/* Media: alt texts and covers show up everywhere. A section not listed resets everything. */
const BY_SECTION: Record<string, CacheGroup[]> = {
	pages: ['pages'],
	news: ['posts'],
	events: ['events'],
	hero: ['hero'],
	settings: ['settings'],
	/* names and blocks: a hero person, a coach or judge card */
	users: ['hero', 'staff'],
	/* /donate: purposes and the recent donations list */
	'donation-purposes': ['settings'],
	payments: ['settings'],
	'point-rules': [],
	media: ALL_GROUPS,
	audit: [],
	roles: [],
	locale: []
};

/**
 * Groups to reset after a request; only admin writes change public data (2.10).
 * Non-staff writes are refused by the admin routes, so they must not cost everyone a cold cache.
 */
export function groupsToInvalidate(method: string, pathname: string, staff: boolean): CacheGroup[] {
	if (!staff || method === 'GET' || method === 'HEAD') return [];
	if (pathname !== '/admin' && !pathname.startsWith('/admin/')) return [];
	const section = pathname.split('/')[2] ?? '';
	return Object.hasOwn(BY_SECTION, section) ? BY_SECTION[section] : ALL_GROUPS;
}
