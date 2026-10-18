import type { CacheGroup } from './memory';

export const ALL_GROUPS: CacheGroup[] = ['settings', 'pages', 'posts', 'events', 'hero'];

/* Media: alt texts and covers show up everywhere. A section not listed resets everything. */
const BY_SECTION: Record<string, CacheGroup[]> = {
	pages: ['pages'],
	news: ['posts'],
	events: ['events'],
	hero: ['hero'],
	settings: ['settings'],
	users: ['hero'],
	media: ALL_GROUPS,
	audit: [],
	roles: [],
	locale: []
};

/** Groups to reset after a request; only admin writes change public data (2.10). */
export function groupsToInvalidate(method: string, pathname: string): CacheGroup[] {
	if (method === 'GET' || method === 'HEAD') return [];
	if (pathname !== '/admin' && !pathname.startsWith('/admin/')) return [];
	const section = pathname.split('/')[2] ?? '';
	return Object.hasOwn(BY_SECTION, section) ? BY_SECTION[section] : ALL_GROUPS;
}
