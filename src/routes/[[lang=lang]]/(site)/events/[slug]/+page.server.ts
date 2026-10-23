import { error } from '@sveltejs/kit';
import { defaultLocale, isLocale } from '#lib/i18n/locales.ts';
import { cached } from '#lib/server/cache/index.ts';
import { db } from '#lib/server/db/index.ts';
import { getPublicEvent } from '#lib/server/services/events/public.ts';
import { eventSeo, withEventCover } from '#lib/server/services/events/view.ts';
import { siteUrl } from '#lib/server/services/posts/view.ts';
import { registrationViewNow } from '#lib/server/services/registrations/index.ts';
import { getSeoBase } from '#lib/server/services/seo/base.ts';
import { registrationActions } from './registration-actions';
import type { Actions, PageServerLoad } from './$types';

/* docs/06 section 4.3: the event is cached for everyone; the registration block is per member. */
export const load: PageServerLoad = async ({ locals, params, url }) => {
	const locale = isLocale(params.lang) ? params.lang : defaultLocale;
	const event = await cached(['events'], 'event', getPublicEvent, db, params.slug, locale);
	if (!event) error(404, 'Not Found');
	const [base, registration] = await Promise.all([
		cached(['settings'], 'seoBase', getSeoBase, db, locale, siteUrl(url)),
		registrationViewNow(db, locals.user?.id ?? null, event.id, locale)
	]);
	const seo = eventSeo(event, base);
	return { event: withEventCover(event), seo, registration };
};

export const actions: Actions = registrationActions;
