import { asc } from 'drizzle-orm';
import { pagePath } from '#lib/page-path.ts';
import type { SitemapEntry } from '#lib/seo/sitemap.ts';
import type { LimitDb } from '../../auth/rate-limit';
import { pages, posts } from '../../db/schema/content';
import { events } from '../../db/schema/events';
import { shopItems } from '../../db/schema/shop';
import { openable } from '../events/public';
import { onSale } from '../shop/public';
import { published } from '../pages/public';
import { visible } from '../posts/public';

/* docs/06 section 7.2: what a guest can open, under the same conditions as the public pages. */

const LISTS = ['/', '/events', '/events/archive', '/news', '/donate', '/federation/team', '/shop'];

export async function listSitemapEntries(db: LimitDb): Promise<SitemapEntry[]> {
	const columns = (table: typeof pages | typeof posts | typeof events | typeof shopItems) => ({
		slug: table.slug,
		lastmod: table.updatedAt
	});
	const [pageRows, postRows, eventRows, itemRows] = await Promise.all([
		db.select(columns(pages)).from(pages).where(published).orderBy(asc(pages.slug)),
		db.select(columns(posts)).from(posts).where(visible).orderBy(asc(posts.slug)),
		db.select(columns(events)).from(events).where(openable).orderBy(asc(events.slug)),
		db.select(columns(shopItems)).from(shopItems).where(onSale).orderBy(asc(shopItems.slug))
	]);
	return [
		...LISTS.map((path) => ({ path })),
		...pageRows.map((r) => ({ path: pagePath(r.slug), lastmod: r.lastmod })),
		...postRows.map((r) => ({ path: `/news/${r.slug}`, lastmod: r.lastmod })),
		...eventRows.map((r) => ({ path: `/events/${r.slug}`, lastmod: r.lastmod })),
		...itemRows.map((r) => ({ path: `/shop/${r.slug}`, lastmod: r.lastmod }))
	];
}
