import { error } from '@sveltejs/kit';
import { defaultLocale, isLocale } from '#lib/i18n/locales.ts';
import { db } from '#lib/server/db/index.ts';
import { getPublicEvent } from '#lib/server/services/events/public.ts';
import { eventSeo, withEventCover } from '#lib/server/services/events/view.ts';
import { siteUrl } from '#lib/server/services/posts/view.ts';
import { getSeoBase } from '#lib/server/services/seo/base.ts';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ params, url }) => {
	const locale = isLocale(params.lang) ? params.lang : defaultLocale;
	const event = await getPublicEvent(db, params.slug, locale);
	if (!event) error(404, 'Not Found');
	const seo = eventSeo(event, await getSeoBase(db, locale, siteUrl(url)));
	return { event: withEventCover(event), seo };
};
