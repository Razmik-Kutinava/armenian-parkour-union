import { error } from '@sveltejs/kit';
import { requirePermission } from '#lib/server/auth/guard.ts';
import { db } from '#lib/server/db/index.ts';
import { getEventPreview } from '#lib/server/services/events/public.ts';
import { eventSeo, withEventCover } from '#lib/server/services/events/view.ts';
import { siteUrl } from '#lib/server/services/posts/view.ts';
import { getSeoBase } from '#lib/server/services/seo/base.ts';
import type { PageServerLoad } from './$types';

/* 2.5 default 9: the saved version in any status, as on the site; only for events.write. */
export const load: PageServerLoad = async ({ locals, params, url }) => {
	requirePermission(locals.user, 'events.write');
	const locale = locals.locale;
	const event = await getEventPreview(db, params.id, locale);
	if (!event) error(404, 'Not found');
	const base = await getSeoBase(db, locale, siteUrl(url));
	return { event: withEventCover(event), shareUrl: eventSeo(event, base).canonical };
};
