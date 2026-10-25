import { and, desc, eq } from 'drizzle-orm';
import type { LimitDb } from '../../auth/rate-limit';
import { shopOrders } from '../../db/schema/shop';
import { linesOf, type OrderLine, type OrderStatus } from '../shop/order-list';
import { isUuid } from '../users/target';

/* docs/06 section 5.8: the signed-in member's orders only (docs/04 section 5.3); no member name or
 * email. Decisions — docs/todo.md 7.7 (3, 4). */

export type OwnOrder = {
	id: string;
	number: string;
	status: OrderStatus;
	totalPoints: number;
	createdAt: Date;
	lines: OrderLine[];
};
export type OwnOrderDetail = OwnOrder & {
	recipientName: string;
	phone: string;
	city: string;
	address: string;
	comment: string | null;
	trackingNote: string | null;
	/** The member cancels only a new order (question 108, decisions.md 2026-10-25). */
	canCancel: boolean;
};

const LIMIT = 100;

const columns = {
	id: shopOrders.id,
	number: shopOrders.number,
	status: shopOrders.status,
	totalPoints: shopOrders.totalPoints,
	createdAt: shopOrders.createdAt
};

export async function listOwnOrders(db: LimitDb, userId: string): Promise<OwnOrder[]> {
	if (!isUuid(userId)) return [];
	const rows = await db
		.select(columns)
		.from(shopOrders)
		.where(eq(shopOrders.userId, userId))
		.orderBy(desc(shopOrders.createdAt), desc(shopOrders.id))
		.limit(LIMIT);
	const lines = await linesOf(
		db,
		rows.map((r) => r.id)
	);
	return rows.map((r) => ({ ...r, lines: lines.get(r.id) ?? [] }));
}

export async function getOwnOrder(
	db: LimitDb,
	userId: string,
	id: string
): Promise<OwnOrderDetail | null> {
	if (!isUuid(userId) || !isUuid(id)) return null;
	const [row] = await db
		.select({
			...columns,
			recipientName: shopOrders.recipientName,
			phone: shopOrders.phone,
			city: shopOrders.city,
			address: shopOrders.address,
			comment: shopOrders.comment,
			trackingNote: shopOrders.trackingNote
		})
		.from(shopOrders)
		.where(and(eq(shopOrders.id, id), eq(shopOrders.userId, userId)));
	if (!row) return null;
	const lines = (await linesOf(db, [id])).get(id) ?? [];
	return { ...row, lines, canCancel: row.status === 'new' };
}
