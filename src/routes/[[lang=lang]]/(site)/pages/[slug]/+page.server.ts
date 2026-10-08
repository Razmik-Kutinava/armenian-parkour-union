import { error, redirect } from '@sveltejs/kit';
import { defaultLocale, isLocale, localizePath } from '#lib/i18n/locales.ts';
import { db } from '#lib/server/db/index.ts';
import { getPublishedPage } from '#lib/server/services/pages/public.ts';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ params }) => {
	const locale = isLocale(params.lang) ? params.lang : defaultLocale;
	if (params.slug === 'about') redirect(301, localizePath('/federation', locale));
	const page = await getPublishedPage(db, params.slug, locale);
	if (!page) error(404, 'Not Found');
	return { page };
};
