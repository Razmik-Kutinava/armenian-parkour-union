import { localizePath } from '#lib/i18n/locales.ts';
import { translate } from '#lib/i18n/translate.ts';
import { buildSeo, textFromHtml, type Seo } from '#lib/seo/meta.ts';
import { publicUrl } from '../../storage/r2';
import type { SeoBase } from '../seo/base';
import type { ShopCard, ShopItem } from './public';

/* What the shop pages render: image addresses from R2 and the meta for messengers (docs/06 § 7). */

export type ShopCardView = ShopCard & { imageUrl: string | null };
export type ShopItemView = Omit<ShopItem, 'images'> & {
	imageUrl: string | null;
	images: { url: string; alt: string }[];
};

export const withImage = <T extends ShopCard>(card: T): T & { imageUrl: string | null } => ({
	...card,
	imageUrl: card.imageKey ? publicUrl(card.imageKey) : null
});

/** Without R2 (local dev) there are no addresses, so no photos. */
export const withImages = (item: ShopItem): ShopItemView => ({
	...withImage(item),
	images: item.images.flatMap((i) => {
		const url = publicUrl(i.key);
		return url ? [{ url, alt: i.alt }] : [];
	})
});

export function itemSeo(item: ShopItemView, base: SeoBase): Seo {
	return buildSeo({
		...base,
		path: localizePath(`/shop/${item.slug}`, base.locale),
		title: item.title,
		description: textFromHtml(item.html) || translate(base.locale, 'shop.description'),
		image: item.imageUrl ? { url: item.imageUrl, alt: item.imageAlt } : null
	});
}
