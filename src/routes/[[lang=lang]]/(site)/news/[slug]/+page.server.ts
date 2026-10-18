import { error } from '@sveltejs/kit';
import { defaultLocale, isLocale } from '#lib/i18n/locales.ts';
import { cached } from '#lib/server/cache/index.ts';
import { db } from '#lib/server/db/index.ts';
import { getPublishedPost, getRelatedPosts } from '#lib/server/services/posts/public.ts';
import { postSeo, siteUrl, withCover } from '#lib/server/services/posts/view.ts';
import { getSeoBase } from '#lib/server/services/seo/base.ts';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ params, url }) => {
	const locale = isLocale(params.lang) ? params.lang : defaultLocale;
	const post = await cached(['posts'], 'post', getPublishedPost, db, params.slug, locale);
	if (!post) error(404, 'Not Found');
	const base = await cached(['settings'], 'seoBase', getSeoBase, db, locale, siteUrl(url));
	const related = await cached(['posts'], 'related', getRelatedPosts, db, post.slug, locale);
	return {
		post: withCover(post),
		related: related.map(withCover),
		seo: postSeo(post, base)
	};
};
