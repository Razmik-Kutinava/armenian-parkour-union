import { error, redirect } from '@sveltejs/kit';
import { defaultLocale, isLocale, localizePath } from '#lib/i18n/locales.ts';
import { pagePath } from '#lib/page-path.ts';
import { cached } from '#lib/server/cache/index.ts';
import { db } from '#lib/server/db/index.ts';
import { getPublishedPage } from '#lib/server/services/pages/public.ts';
import { pageSeo } from '#lib/server/services/pages/view.ts';
import { siteUrl } from '#lib/server/services/posts/view.ts';
import { getSeoBase } from '#lib/server/services/seo/base.ts';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ params, url }) => {
	const locale = isLocale(params.lang) ? params.lang : defaultLocale;
	const own = pagePath(params.slug);
	if (own !== `/pages/${params.slug}`) redirect(301, localizePath(own, locale));
	const page = await cached(['pages'], 'page', getPublishedPage, db, params.slug, locale);
	if (!page) error(404, 'Not Found');
	const base = await cached(['settings'], 'seoBase', getSeoBase, db, locale, siteUrl(url));
	return { page, seo: pageSeo(page, base) };
};
