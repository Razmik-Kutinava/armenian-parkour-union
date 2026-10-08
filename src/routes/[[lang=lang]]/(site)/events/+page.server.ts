import { defaultLocale, isLocale, localizePath } from '#lib/i18n/locales.ts';
import { translate } from '#lib/i18n/translate.ts';
import { db } from '#lib/server/db/index.ts';
import {
	EVENTS_PAGE_SIZE,
	listUpcomingCities,
	listUpcomingEvents,
	type UpcomingQuery
} from '#lib/server/services/events/public.ts';
import { withEventCover } from '#lib/server/services/events/view.ts';
import { siteUrl } from '#lib/server/services/posts/view.ts';
import { buildSeo } from '#lib/seo/meta.ts';
import { disciplines } from '#lib/validation/events.ts';
import type { PageServerLoad } from './$types';

/* docs/06 section 4.2; filters through the address — 2.5 default 4. */
const oneOf = <T extends string>(value: string | null, allowed: readonly T[]) =>
	allowed.includes(value as T) ? (value as T) : undefined;

export const load: PageServerLoad = async ({ params, url }) => {
	const locale = isLocale(params.lang) ? params.lang : defaultLocale;
	const q = url.searchParams;
	const rawPage = q.get('page') ?? '';
	const filters = {
		city: (q.get('city') ?? '').trim().slice(0, 100) || undefined,
		period: oneOf(q.get('period'), ['week', 'month', '3months'] as const),
		price: oneOf(q.get('price'), ['free', 'paid'] as const),
		discipline: oneOf(q.get('discipline'), disciplines)
	} satisfies Partial<UpcomingQuery>;
	const page = /^\d{1,6}$/.test(rawPage) && Number(rawPage) >= 1 ? Number(rawPage) : 1;
	const [{ rows, total }, cities] = await Promise.all([
		listUpcomingEvents(db, { locale, page, ...filters }),
		listUpcomingCities(db)
	]);
	const query = new URLSearchParams(
		Object.entries({ ...filters, page: page > 1 ? String(page) : undefined }).filter(
			(e): e is [string, string] => !!e[1]
		)
	).toString();
	return {
		filters,
		page,
		pages: Math.max(1, Math.ceil(total / EVENTS_PAGE_SIZE)),
		cities,
		events: rows.map(withEventCover),
		seo: buildSeo({
			siteUrl: siteUrl(url),
			siteName: translate(locale, 'site.name'),
			path: localizePath('/events', locale) + (query ? `?${query}` : ''),
			locale,
			title: translate(locale, 'nav.events'),
			description: translate(locale, 'events.list.description')
		})
	};
};
