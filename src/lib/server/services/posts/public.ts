import { and, count, desc, eq, isNull, lte, ne, sql, type SQL } from 'drizzle-orm';
import { pickLocalized, type LocalizedText } from '#lib/i18n/localized.ts';
import type { Locale } from '#lib/i18n/locales.ts';
import type { PostText } from '#lib/validation/posts.ts';
import type { LimitDb } from '../../auth/rate-limit';
import { posts } from '../../db/schema/content';
import { media } from '../../db/schema/service';
import { isUuid } from '../users/target';

/* docs/06 section 4.4; visibility — docs/03 section 12 item 1. HTML was cleaned on save. */

export const NEWS_PAGE_SIZE = 12;

export type PostCard = {
	slug: string;
	title: string;
	excerpt: string;
	coverKey: string | null;
	coverAlt: string;
	tags: string[];
	publishedAt: Date | null;
};
export type PublicPost = PostCard & { id: string; html: string; updatedAt: Date };

/** Guests see a post only when it is published and its date has come. */
const visible = and(
	eq(posts.status, 'published'),
	lte(posts.publishedAt, sql`now()`),
	isNull(posts.deletedAt)
);

const cardColumns = {
	slug: posts.slug,
	title: posts.title,
	excerpt: posts.excerpt,
	coverKey: posts.coverKey,
	coverAlt: media.alt,
	tags: posts.tags,
	publishedAt: posts.publishedAt
};
const coverJoin = and(eq(media.key, posts.coverKey), isNull(media.deletedAt));

type CardRow = { [K in keyof typeof cardColumns]: unknown };
const pick = (text: unknown, locale: Locale) => {
	const t = (text ?? {}) as PostText;
	return t[locale] || t.en || '';
};
const toCard = (row: CardRow, locale: Locale): PostCard => ({
	slug: row.slug as string,
	title: pickLocalized(row.title as LocalizedText, locale),
	excerpt: pick(row.excerpt, locale),
	coverKey: row.coverKey as string | null,
	coverAlt: pick(row.coverAlt, locale),
	tags: row.tags as string[],
	publishedAt: row.publishedAt as Date | null
});

async function cards(db: LimitDb, where: SQL | undefined, limit: number, offset = 0) {
	return db
		.select(cardColumns)
		.from(posts)
		.leftJoin(media, coverJoin)
		.where(where)
		.orderBy(desc(posts.publishedAt), desc(posts.id))
		.limit(limit)
		.offset(offset);
}

export async function listPublishedPosts(
	db: LimitDb,
	{ locale, tag, page }: { locale: Locale; tag?: string; page: number }
): Promise<{ rows: PostCard[]; total: number }> {
	const where = tag ? and(visible, sql`${tag} = any(${posts.tags})`) : visible;
	const rows = await cards(db, where, NEWS_PAGE_SIZE, (page - 1) * NEWS_PAGE_SIZE);
	const [{ total }] = await db.select({ total: count() }).from(posts).where(where);
	return { rows: rows.map((r) => toCard(r, locale)), total };
}

/** "Read also" (docs/06 section 4.4): the latest visible posts except the one shown. */
export async function getRelatedPosts(
	db: LimitDb,
	exceptSlug: string,
	locale: Locale,
	limit = 3
): Promise<PostCard[]> {
	const rows = await cards(db, and(visible, ne(posts.slug, exceptSlug)), limit);
	return rows.map((r) => toCard(r, locale));
}

async function onePost(db: LimitDb, where: SQL | undefined, locale: Locale) {
	const [row] = await db
		.select({ ...cardColumns, id: posts.id, body: posts.body, updatedAt: posts.updatedAt })
		.from(posts)
		.leftJoin(media, coverJoin)
		.where(where);
	if (!row) return null;
	return {
		...toCard(row, locale),
		id: row.id,
		html: pick(row.body, locale),
		updatedAt: row.updatedAt
	} satisfies PublicPost;
}

export const getPublishedPost = (db: LimitDb, slug: string, locale: Locale) =>
	onePost(db, and(visible, eq(posts.slug, slug)), locale);

/** Admin preview (posts.write is checked by the route): the saved post in any status. */
export const getPostPreview = async (db: LimitDb, id: string, locale: Locale) =>
	isUuid(id) ? onePost(db, and(eq(posts.id, id), isNull(posts.deletedAt)), locale) : null;
