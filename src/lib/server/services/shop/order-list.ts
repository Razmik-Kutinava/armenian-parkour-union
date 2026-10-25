import { and, asc, count, desc, eq, ilike, inArray, or, sql, type SQL } from 'drizzle-orm';
import {
	PAGE_SIZE,
	pageOffset,
	type ListOptions,
	type ListState
} from '#lib/components/admin/list-state.ts';
import type { LocalizedText } from '#lib/i18n/localized.ts';
import type { LimitDb } from '../../auth/rate-limit';
import { orderStatus } from '../../db/schema/enums';
import { shopItems, shopOrderItems, shopOrders } from '../../db/schema/shop';
import { users } from '../../db/schema/users';
import { validDay, ZONE } from '../audit-list';
import { isUuid } from '../users/target';

/* docs/05 section 15: number, member, lines, total, status, date; filters — status, period (days in
 * Yerevan); search — the number or the member name. No email (docs/todo.md 7.4, decision 9). */

export const orderListOptions: ListOptions = {
	sortable: [],
	filters: ['status', 'from', 'to'],
	defaultSort: { key: 'createdAt', dir: 'desc' }
};

export type OrderStatus = (typeof orderStatus.enumValues)[number];
export type OrderLine = {
	itemId: string;
	title: LocalizedText;
	quantity: number;
	pricePointsSnapshot: number;
	selectedOptions: Record<string, string> | null;
};
export type OrderRow = {
	id: string;
	number: string;
	userId: string;
	memberName: string;
	totalPoints: number;
	status: OrderStatus;
	createdAt: Date;
	lines: OrderLine[];
};
export type OrderDetail = OrderRow & {
	recipientName: string;
	phone: string;
	city: string;
	address: string;
	comment: string | null;
	trackingNote: string | null;
	updatedAt: Date;
};

const escapeLike = (s: string) => s.replace(/[\\%_]/g, (c) => `\\${c}`);

function conditions({ q, filters }: ListState): SQL | undefined {
	const where: SQL[] = [];
	if (q) {
		const like = `%${escapeLike(q)}%`;
		where.push(or(ilike(shopOrders.number, like), ilike(users.name, like)) as SQL);
	}
	const status = orderStatus.enumValues.find((s) => s === filters.status);
	if (status) where.push(eq(shopOrders.status, status));
	const from = validDay(filters.from);
	if (from) {
		where.push(sql`${shopOrders.createdAt} >= (${from}::date)::timestamp at time zone ${ZONE}`);
	}
	const to = validDay(filters.to);
	if (to) {
		where.push(sql`${shopOrders.createdAt} < (${to}::date + 1)::timestamp at time zone ${ZONE}`);
	}
	return and(...where);
}

const rowColumns = {
	id: shopOrders.id,
	number: shopOrders.number,
	userId: shopOrders.userId,
	memberName: users.name,
	totalPoints: shopOrders.totalPoints,
	status: shopOrders.status,
	createdAt: shopOrders.createdAt
};

async function linesOf(db: LimitDb, orderIds: string[]): Promise<Map<string, OrderLine[]>> {
	const byOrder = new Map<string, OrderLine[]>();
	if (orderIds.length === 0) return byOrder;
	const rows = await db
		.select({
			orderId: shopOrderItems.orderId,
			itemId: shopOrderItems.itemId,
			title: shopItems.title,
			quantity: shopOrderItems.quantity,
			pricePointsSnapshot: shopOrderItems.pricePointsSnapshot,
			selectedOptions: shopOrderItems.selectedOptions
		})
		.from(shopOrderItems)
		.innerJoin(shopItems, eq(shopItems.id, shopOrderItems.itemId))
		.where(inArray(shopOrderItems.orderId, orderIds))
		.orderBy(asc(shopOrderItems.createdAt), asc(shopOrderItems.id));
	for (const { orderId, ...line } of rows) {
		const list = byOrder.get(orderId) ?? [];
		list.push({
			...line,
			title: line.title as LocalizedText,
			selectedOptions: line.selectedOptions ?? null
		});
		byOrder.set(orderId, list);
	}
	return byOrder;
}

export async function listOrders(
	db: LimitDb,
	state: ListState
): Promise<{ rows: OrderRow[]; total: number }> {
	const where = conditions(state);
	const rows = await db
		.select(rowColumns)
		.from(shopOrders)
		.innerJoin(users, eq(users.id, shopOrders.userId))
		.where(where)
		.orderBy(desc(shopOrders.createdAt), desc(shopOrders.id))
		.limit(PAGE_SIZE)
		.offset(pageOffset(state.page));
	const [{ total }] = await db
		.select({ total: count() })
		.from(shopOrders)
		.innerJoin(users, eq(users.id, shopOrders.userId))
		.where(where);
	const lines = await linesOf(
		db,
		rows.map((r) => r.id)
	);
	return { rows: rows.map((r) => ({ ...r, lines: lines.get(r.id) ?? [] })), total };
}

export async function getOrder(db: LimitDb, id: string): Promise<OrderDetail | null> {
	if (!isUuid(id)) return null;
	const [row] = await db
		.select({
			...rowColumns,
			recipientName: shopOrders.recipientName,
			phone: shopOrders.phone,
			city: shopOrders.city,
			address: shopOrders.address,
			comment: shopOrders.comment,
			trackingNote: shopOrders.trackingNote,
			updatedAt: shopOrders.updatedAt
		})
		.from(shopOrders)
		.innerJoin(users, eq(users.id, shopOrders.userId))
		.where(eq(shopOrders.id, id));
	if (!row) return null;
	return { ...row, lines: (await linesOf(db, [id])).get(id) ?? [] };
}
