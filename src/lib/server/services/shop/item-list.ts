import { and, asc, count, desc, eq, isNull, sql, type SQL } from 'drizzle-orm';
import {
	PAGE_SIZE,
	pageOffset,
	type ListOptions,
	type ListState
} from '#lib/components/admin/list-state.ts';
import type { LocalizedText } from '#lib/i18n/localized.ts';
import { pageStatuses, type PageStatus } from '#lib/validation/pages.ts';
import type { PostText } from '#lib/validation/posts.ts';
import type { LimitDb } from '../../auth/rate-limit';
import { shopItems } from '../../db/schema/shop';
import { isUuid } from '../users/target';

/* docs/05 section 14: photo, title, price, stock, status; filters — status, out of stock. */

export const itemListOptions: ListOptions = {
	sortable: [],
	filters: ['status', 'stock'],
	defaultSort: { key: 'sortOrder', dir: 'asc' }
};

export type ItemRow = {
	id: string;
	slug: string;
	title: LocalizedText;
	imageKeys: string[];
	pricePoints: number;
	stock: number | null;
	status: PageStatus;
};
export type ItemDetail = ItemRow & {
	description: PostText;
	options: Record<string, string[]> | null;
	sortOrder: number;
	updatedAt: Date;
};

const escapeLike = (s: string) => s.replace(/[\\%_]/g, (c) => `\\${c}`);

function conditions({ q, filters }: ListState): SQL[] {
	const where: SQL[] = [isNull(shopItems.deletedAt)];
	if (q) where.push(sql`${shopItems.title}::text ilike ${`%${escapeLike(q)}%`}`);
	const status = pageStatuses.find((s) => s === filters.status);
	if (status) where.push(eq(shopItems.status, status));
	if (filters.stock === 'out') where.push(eq(shopItems.stock, 0));
	return where;
}

const rowColumns = {
	id: shopItems.id,
	slug: shopItems.slug,
	title: shopItems.title,
	imageKeys: shopItems.imageKeys,
	pricePoints: shopItems.pricePoints,
	stock: shopItems.stock,
	status: shopItems.status
};

/** Display order first, then the newest. */
export async function listItems(
	db: LimitDb,
	state: ListState
): Promise<{ rows: ItemRow[]; total: number }> {
	const where = and(...conditions(state));
	const rows = await db
		.select(rowColumns)
		.from(shopItems)
		.where(where)
		.orderBy(asc(shopItems.sortOrder), desc(shopItems.createdAt), asc(shopItems.id))
		.limit(PAGE_SIZE)
		.offset(pageOffset(state.page));
	const [{ total }] = await db.select({ total: count() }).from(shopItems).where(where);
	return { rows: rows as ItemRow[], total };
}

export async function getItem(db: LimitDb, id: string): Promise<ItemDetail | null> {
	if (!isUuid(id)) return null;
	const [row] = await db
		.select({
			...rowColumns,
			description: shopItems.description,
			options: shopItems.options,
			sortOrder: shopItems.sortOrder,
			updatedAt: shopItems.updatedAt
		})
		.from(shopItems)
		.where(and(eq(shopItems.id, id), isNull(shopItems.deletedAt)));
	return (row as ItemDetail | undefined) ?? null;
}
