import { error } from '@sveltejs/kit';
import { requirePermission } from '#lib/server/auth/guard.ts';
import { db } from '#lib/server/db/index.ts';
import { getPostPreview } from '#lib/server/services/posts/public.ts';
import { postSeo, withCover } from '#lib/server/services/posts/view.ts';
import type { PageServerLoad } from './$types';

/* Decision 2.4: the saved version in any status, as on the site; only for posts.write. */
export const load: PageServerLoad = async ({ locals, params, url }) => {
	requirePermission(locals.user, 'posts.write');
	const locale = locals.locale;
	const post = await getPostPreview(db, params.id, locale);
	if (!post) error(404, 'Not found');
	return { post: withCover(post), shareUrl: postSeo(post, locale, url).canonical };
};
