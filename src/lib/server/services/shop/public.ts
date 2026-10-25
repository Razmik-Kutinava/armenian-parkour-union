import { and, asc, count, desc, eq, inArray, isNull, sql, type SQL } from 'drizzle-orm';
import { pickLocalized, type LocalizedText } from '#lib/i18n/localized.ts';
import type { Locale } from '#lib/i18n/locales.ts';
import type { PostText } from '#lib/validation/posts.ts';
import type { LimitDb } from '../../auth/rate-limit';
import { media } from '../../db/schema/service';
import { shopItems } from '../../db/schema/shop';

/* docs/06 section 4.7, docs/03 section 9 item 1. Description HTML was cleaned on save (7.4). */

export const SHOP_PAGE_SIZE = 24;

export type ShopCard = {
	slug: string;
	title: string;
	pricePoints: number;
	outOfStock: boolean;
	imageKey: string | null;
	imageAlt: string;
};
export type ShopImage = { key: string; alt: string };
export type ShopItem = ShopCard & {
	id: string;
	images: ShopImage[];
	html: string;
	options: { name: string; values: string[] }[];
	updatedAt: Date;
};

export const onSale = and(eq(shopItems.status, 'published'), isNull(shopItems.deletedAt));

const pick = (text: unknown, locale: Locale) => {
	const t = (text ?? {}) as PostText;
	return t[locale] || t.en || '';
};

/** Alt texts of library images that are not deleted, in the item's order. */
async function imagesOf(db: LimitDb, keys: string[], locale: Locale): Promise<ShopImage[]> {
	if (keys.length === 0) return [];
	const rows = await db
		.select({ key: media.key, alt: media.alt })
		.from(media)
		.where(and(inArray(media.key, keys), isNull(media.deletedAt)));
	const alts = new Map(rows.map((r) => [r.key, pick(r.alt, locale)]));
	return keys.filter((k) => alts.has(k)).map((key) => ({ key, alt: alts.get(key)! }));
}

const cardColumns = {
	slug: shopItems.slug,
	title: shopItems.title,
	pricePoints: shopItems.pricePoints,
	stock: shopItems.stock,
	imageKey: media.key,
	imageAlt: media.alt
};
const coverJoin = and(sql`${media.key} = ${shopItems.imageKeys}->>0`, isNull(media.deletedAt));

type CardRow = { [K in keyof typeof cardColumns]: unknown };
const toCard = (row: CardRow, locale: Locale): ShopCard => ({
	slug: row.slug as string,
	title: pickLocalized(row.title as LocalizedText, locale),
	pricePoints: row.pricePoints as number,
	outOfStock: row.stock === 0,
	imageKey: (row.imageKey as string | null) ?? null,
	imageAlt: row.imageKey ? pick(row.imageAlt, locale) : ''
});

/** Display order first, then the newest. */
export async function listShopItems(
	db: LimitDb,
	{ locale, page }: { locale: Locale; page: number }
): Promise<{ rows: ShopCard[]; total: number }> {
	const rows = await db
		.select(cardColumns)
		.from(shopItems)
		.leftJoin(media, coverJoin)
		.where(onSale)
		.orderBy(asc(shopItems.sortOrder), desc(shopItems.createdAt), asc(shopItems.id))
		.limit(SHOP_PAGE_SIZE)
		.offset((page - 1) * SHOP_PAGE_SIZE);
	const [{ total }] = await db.select({ total: count() }).from(shopItems).where(onSale);
	return { rows: rows.map((r) => toCard(r, locale)), total };
}

export async function getShopItem(
	db: LimitDb,
	slug: string,
	locale: Locale
): Promise<ShopItem | null> {
	const where: SQL | undefined = and(onSale, eq(shopItems.slug, slug));
	const [row] = await db
		.select({
			...cardColumns,
			id: shopItems.id,
			imageKeys: shopItems.imageKeys,
			description: shopItems.description,
			options: shopItems.options,
			updatedAt: shopItems.updatedAt
		})
		.from(shopItems)
		.leftJoin(media, coverJoin)
		.where(where);
	if (!row) return null;
	const images = await imagesOf(db, row.imageKeys, locale);
	return {
		...toCard(row, locale),
		imageKey: images[0]?.key ?? null,
		imageAlt: images[0]?.alt ?? '',
		id: row.id,
		images,
		html: pick(row.description, locale),
		options: Object.entries(row.options ?? {}).map(([name, values]) => ({ name, values })),
		updatedAt: row.updatedAt
	};
}
