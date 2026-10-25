import { defaultLocale, isLocale, localizePath } from '#lib/i18n/locales.ts';
import { translate } from '#lib/i18n/translate.ts';
import { cached } from '#lib/server/cache/index.ts';
import { db } from '#lib/server/db/index.ts';
import { siteUrl } from '#lib/server/services/posts/view.ts';
import { getSeoBase } from '#lib/server/services/seo/base.ts';
import { listShopItems, SHOP_PAGE_SIZE } from '#lib/server/services/shop/public.ts';
import { withImage } from '#lib/server/services/shop/view.ts';
import { buildSeo } from '#lib/seo/meta.ts';
import type { PageServerLoad } from './$types';

/* docs/06 section 4.7: cards with photo, title, price in points, "out of stock". */
export const load: PageServerLoad = async ({ params, url }) => {
	const locale = isLocale(params.lang) ? params.lang : defaultLocale;
	const rawPage = url.searchParams.get('page') ?? '';
	const page = /^\d{1,6}$/.test(rawPage) && Number(rawPage) >= 1 ? Number(rawPage) : 1;
	const [{ rows, total }, base] = await Promise.all([
		cached(['shop'], 'shop', listShopItems, db, { locale, page }),
		cached(['settings'], 'seoBase', getSeoBase, db, locale, siteUrl(url))
	]);
	return {
		page,
		pages: Math.max(1, Math.ceil(total / SHOP_PAGE_SIZE)),
		items: rows.map(withImage),
		seo: buildSeo({
			...base,
			path: localizePath('/shop', locale) + (page > 1 ? `?page=${page}` : ''),
			title: translate(locale, 'shop.title'),
			description: translate(locale, 'shop.description')
		})
	};
};
