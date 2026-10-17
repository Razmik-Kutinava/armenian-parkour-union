import { error, redirect } from '@sveltejs/kit';
import { defaultLocale, isLocale, localizePath } from '#lib/i18n/locales.ts';
import { db } from '#lib/server/db/index.ts';
import { getPublishedPage } from '#lib/server/services/pages/public.ts';
import { pageSeo } from '#lib/server/services/pages/view.ts';
import { siteUrl } from '#lib/server/services/posts/view.ts';
import { getSeoBase } from '#lib/server/services/seo/base.ts';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ params, url }) => {
	const locale = isLocale(params.lang) ? params.lang : defaultLocale;
	if (params.slug === 'about') redirect(301, localizePath('/federation', locale));
	const page = await getPublishedPage(db, params.slug, locale);
	if (!page) error(404, 'Not Found');
	return { page, seo: pageSeo(page, await getSeoBase(db, locale, siteUrl(url))) };
};
