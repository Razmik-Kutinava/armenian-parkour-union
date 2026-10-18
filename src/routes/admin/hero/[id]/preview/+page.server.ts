import { error } from '@sveltejs/kit';
import { requirePermission } from '#lib/server/auth/guard.ts';
import { db } from '#lib/server/db/index.ts';
import { getHeroPreview } from '#lib/server/services/hero/preview.ts';
import { withHeroMedia } from '#lib/server/services/hero/view.ts';
import type { PageServerLoad } from './$types';

/* docs/05 section 4: the saved block as on the home page; only for hero.write. */
export const load: PageServerLoad = async ({ locals, params }) => {
	requirePermission(locals.user, 'hero.write');
	const slide = await getHeroPreview(db, params.id, locals.locale);
	if (!slide) error(404, 'Not found');
	return { slide: withHeroMedia(slide) };
};
