import { cached } from '#lib/server/cache/index.ts';
import { db } from '#lib/server/db/index.ts';
import { siteUrl } from '#lib/server/services/posts/view.ts';
import { listSitemapEntries } from '#lib/server/services/seo/sitemap.ts';
import { renderSitemap } from '#lib/seo/sitemap.ts';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ url }) => {
	const entries = await cached(['pages', 'posts', 'events'], 'sitemap', listSitemapEntries, db);
	return new Response(renderSitemap(siteUrl(url), entries), {
		headers: { 'content-type': 'application/xml; charset=utf-8', 'cache-control': 'max-age=3600' }
	});
};
