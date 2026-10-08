import { error } from '@sveltejs/kit';
import { defaultLocale, isLocale } from '#lib/i18n/locales.ts';
import { db } from '#lib/server/db/index.ts';
import { getPublishedPost, getRelatedPosts } from '#lib/server/services/posts/public.ts';
import { postSeo, withCover } from '#lib/server/services/posts/view.ts';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ params, url }) => {
	const locale = isLocale(params.lang) ? params.lang : defaultLocale;
	const post = await getPublishedPost(db, params.slug, locale);
	if (!post) error(404, 'Not Found');
	const seo = postSeo(post, locale, url);
	return {
		post: withCover(post),
		related: (await getRelatedPosts(db, post.slug, locale)).map(withCover),
		seo
	};
};
