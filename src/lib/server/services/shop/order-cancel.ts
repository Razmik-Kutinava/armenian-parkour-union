import { and, asc, eq, isNotNull, sql } from 'drizzle-orm';
import { roleCan } from '../../auth/permissions';
import type { LimitDb } from '../../auth/rate-limit';
import { pointsLedger } from '../../db/schema/points';
import { shopItems, shopOrderItems, shopOrders } from '../../db/schema/shop';
import { writeAudit } from '../audit';
import { appendEntry } from '../points/ledger';
import { isUuid, type Actor } from '../users/target';
import { orderStatusLetter } from './order-mail';
import { lockOrder, type OrderDeps } from './orders';

/* docs/03 section 9 item 5, docs/05 section 15, docs/04 section 3.2; decisions — docs/todo.md
 * 7.6 (5, 6, 8). Locks: order → member (`appendEntry`) → items, as in checkout.ts. */

type Outcome = 'ok' | 'bad_status' | 'not_found' | 'not_allowed';
type Order = typeof shopOrders.$inferSelect;

const CANCELLABLE: readonly string[] = ['new', 'confirmed'];

/** The write-off entry back with the opposite sign; none, or a deleted account — nothing back. */
async function refund(tx: LimitDb, order: Order, actorId: string) {
	if (!order.ledgerId) return { points: 0, entryId: null };
	const [spent] = await tx
		.select({ delta: pointsLedger.delta })
		.from(pointsLedger)
		.where(eq(pointsLedger.id, order.ledgerId));
	const result = await appendEntry(tx, {
		userId: order.userId,
		delta: -spent.delta,
		reason: 'shop_refund',
		sourceType: 'shop_order',
		sourceId: order.id,
		createdBy: actorId
	});
	if (result.status === 'ok') return { points: result.entry.delta, entryId: result.entry.id };
	if (result.status === 'no_user') return { points: 0, entryId: null };
	throw new Error(`order ${order.id}: refund ${result.status}`);
}

/** Limited items get their pieces back; `null` (no limit) stays. In item order, like any lock. */
async function restoreStock(tx: LimitDb, orderId: string) {
	const lines = await tx
		.select({ itemId: shopOrderItems.itemId, quantity: shopOrderItems.quantity })
		.from(shopOrderItems)
		.where(eq(shopOrderItems.orderId, orderId))
		.orderBy(asc(shopOrderItems.itemId));
	for (const line of lines) {
		await tx
			.update(shopItems)
			.set({ stock: sql`${shopItems.stock} + ${line.quantity}` })
			.where(and(eq(shopItems.id, line.itemId), isNotNull(shopItems.stock)));
	}
}

/** Admin only, before `shipped`: points and stock back, the order `cancelled`, a letter. */
export async function cancelOrder(
	db: LimitDb,
	actor: Actor,
	id: string,
	deps: OrderDeps
): Promise<Outcome> {
	if (!roleCan(actor.role, 'shop.orders_cancel')) return 'not_allowed';
	if (!isUuid(id)) return 'not_found';
	const outcome = await db.transaction(async (tx) => {
		const row = await lockOrder(tx, id);
		if (!row) return 'not_found' as const;
		const { order, user } = row;
		if (!CANCELLABLE.includes(order.status)) return 'bad_status' as const;
		const back = await refund(tx, order, actor.id);
		await restoreStock(tx, id);
		await tx.update(shopOrders).set({ status: 'cancelled' }).where(eq(shopOrders.id, id));
		await writeAudit(tx, {
			actorId: actor.id,
			action: 'shop_order.cancel',
			entityType: 'shop_order',
			entityId: id,
			before: { status: order.status },
			after: {
				status: 'cancelled',
				number: order.number,
				refund: back.points,
				entryId: back.entryId
			},
			ip: deps.ip
		});
		if (user.deletedAt) return null;
		return orderStatusLetter(user, { ...order, status: 'cancelled' }, deps.siteUrl);
	});
	if (typeof outcome === 'string') return outcome;
	if (outcome) {
		await deps.send(outcome).catch((e) => console.warn(`order ${id}: letter not sent`, e));
	}
	return 'ok';
}
