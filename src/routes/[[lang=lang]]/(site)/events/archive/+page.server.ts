import { defaultLocale, isLocale, localizePath } from '#lib/i18n/locales.ts';
import { translate } from '#lib/i18n/translate.ts';
import { db } from '#lib/server/db/index.ts';
import { EVENTS_PAGE_SIZE, listArchivedEvents } from '#lib/server/services/events/public.ts';
import { withEventCover } from '#lib/server/services/events/view.ts';
import { siteUrl } from '#lib/server/services/posts/view.ts';
import { buildSeo } from '#lib/seo/meta.ts';
import type { PageServerLoad } from './$types';

/* docs/06 section 4.2, docs/03 section 7.9: finished events, latest first. */
export const load: PageServerLoad = async ({ params, url }) => {
	const locale = isLocale(params.lang) ? params.lang : defaultLocale;
	const rawPage = url.searchParams.get('page') ?? '';
	const page = /^\d{1,6}$/.test(rawPage) && Number(rawPage) >= 1 ? Number(rawPage) : 1;
	const { rows, total } = await listArchivedEvents(db, { locale, page });
	return {
		page,
		pages: Math.max(1, Math.ceil(total / EVENTS_PAGE_SIZE)),
		events: rows.map(withEventCover),
		seo: buildSeo({
			siteUrl: siteUrl(url),
			siteName: translate(locale, 'site.name'),
			path: localizePath('/events/archive', locale) + (page > 1 ? `?page=${page}` : ''),
			locale,
			title: translate(locale, 'events.archive.title'),
			description: translate(locale, 'events.archive.description')
		})
	};
};
