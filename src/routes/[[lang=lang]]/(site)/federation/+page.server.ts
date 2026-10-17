import { error } from '@sveltejs/kit';
import { defaultLocale, isLocale } from '#lib/i18n/locales.ts';
import { db } from '#lib/server/db/index.ts';
import { getPublishedPage } from '#lib/server/services/pages/public.ts';
import { pageSeo } from '#lib/server/services/pages/view.ts';
import { siteUrl } from '#lib/server/services/posts/view.ts';
import { getSeoBase } from '#lib/server/services/seo/base.ts';
import type { PageServerLoad } from './$types';

/* docs/06 section 3.1: "About" is the system page `about`. */
export const load: PageServerLoad = async ({ params, url }) => {
	const locale = isLocale(params.lang) ? params.lang : defaultLocale;
	const page = await getPublishedPage(db, 'about', locale);
	if (!page) error(404, 'Not Found');
	return { page, seo: pageSeo(page, await getSeoBase(db, locale, siteUrl(url))) };
};
