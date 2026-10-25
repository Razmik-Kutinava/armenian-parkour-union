import { error } from '@sveltejs/kit';
import { defaultLocale, isLocale } from '#lib/i18n/locales.ts';
import { cached } from '#lib/server/cache/index.ts';
import { db } from '#lib/server/db/index.ts';
import { siteUrl } from '#lib/server/services/posts/view.ts';
import { getSeoBase } from '#lib/server/services/seo/base.ts';
import { orderButton } from '#lib/server/services/shop/order-button.ts';
import { getShopItem } from '#lib/server/services/shop/public.ts';
import { itemSeo, withImages } from '#lib/server/services/shop/view.ts';
import type { PageServerLoad } from './$types';

/* docs/06 section 4.7: the item is cached for everyone; the order button is per user, read now. */
export const load: PageServerLoad = async ({ locals, params, url }) => {
	const locale = isLocale(params.lang) ? params.lang : defaultLocale;
	const found = await cached(['shop'], 'shopItem', getShopItem, db, params.slug, locale);
	if (!found) error(404, 'Not Found');
	const [base, button] = await Promise.all([
		cached(['settings'], 'seoBase', getSeoBase, db, locale, siteUrl(url)),
		orderButton(db, locals.user?.id ?? null, found.id)
	]);
	const item = withImages(found);
	return { item, button, seo: itemSeo(item, base) };
};
