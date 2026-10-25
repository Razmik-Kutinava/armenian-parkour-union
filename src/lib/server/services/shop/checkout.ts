import { eq, sql } from 'drizzle-orm';
import type { LimitDb } from '../../auth/rate-limit';
import { shopItems, shopOrderItems, shopOrders } from '../../db/schema/shop';
import type { Mail } from '../../mail/resend';
import { appendEntry } from '../points/ledger';
import { isUuid } from '../users/target';
import { lockBuyer, lockItemOnSale, pickOptions } from './checkout-data';
import { orderStatusLetter } from './order-mail';
import { nextOrderNumber } from './order-number';

/* docs/03 section 9 item 3: one transaction — member, stock, points, the price snapshot.
 * Decisions — docs/todo.md 7.6 (1–4, 6). Locks: the member row, then the item row (the cancel
 * takes order → member → items), so the two never wait on each other in a circle. */

export type Delivery = {
	recipientName: string;
	phone: string;
	city: string;
	address: string;
	comment: string | null;
};
/** `orderId` is issued on the confirmation step: sending it twice places one order. */
export type PlaceOrderInput = {
	orderId: string;
	itemId: string;
	options: Record<string, string>;
	delivery: Delivery;
};
type Refusal =
	'not_found' | 'not_allowed' | 'out_of_stock' | 'email_unverified' | 'options_invalid';
export type PlaceOrderResult =
	| { ok: true; id: string; number: string; points: number; repeated: boolean }
	| { ok: false; reason: Refusal }
	| { ok: false; reason: 'short'; missing: number };
export type CheckoutDeps = { send: (mail: Mail) => Promise<void>; siteUrl: string | undefined };

const refuse = (reason: Refusal) => ({ result: { ok: false, reason } as const });

export async function placeOrder(
	db: LimitDb,
	userId: string,
	input: PlaceOrderInput,
	deps: CheckoutDeps,
	now = new Date()
): Promise<PlaceOrderResult> {
	if (![userId, input.orderId, input.itemId].every(isUuid)) return refuse('not_found').result;
	type Placed = { result: PlaceOrderResult; letter?: Mail };
	const { result, letter } = await db.transaction(async (tx): Promise<Placed> => {
		const user = await lockBuyer(tx, userId);
		if (!user) return refuse('not_found');
		const [earlier] = await tx
			.select({
				userId: shopOrders.userId,
				number: shopOrders.number,
				points: shopOrders.totalPoints
			})
			.from(shopOrders)
			.where(eq(shopOrders.id, input.orderId));
		if (earlier) {
			const { userId: owner, ...placed } = earlier;
			if (owner !== userId) return refuse('not_found');
			return { result: { ok: true, id: input.orderId, ...placed, repeated: true } };
		}
		if (user.status !== 'active') return refuse('not_allowed');
		const item = await lockItemOnSale(tx, input.itemId);
		if (!item) return refuse('not_found');
		if (item.stock === 0) return refuse('out_of_stock');
		if (!user.emailVerified) return refuse('email_unverified');
		const options = pickOptions(item.options, input.options);
		if (options === undefined) return refuse('options_invalid');
		if (user.balance < item.price) {
			return { result: { ok: false, reason: 'short', missing: item.price - user.balance } };
		}

		const number = await nextOrderNumber(tx, now);
		const [order] = await tx
			.insert(shopOrders)
			.values({ id: input.orderId, number, userId, totalPoints: item.price, ...input.delivery })
			.returning();
		const spent = await appendEntry(tx, {
			userId,
			delta: -item.price,
			reason: 'shop_order',
			sourceType: 'shop_order',
			sourceId: order.id,
			createdBy: null
		});
		if (spent.status !== 'ok') throw new Error(`order ${order.id}: write-off ${spent.status}`);
		await tx
			.update(shopOrders)
			.set({ ledgerId: spent.entry.id })
			.where(eq(shopOrders.id, order.id));
		await tx.insert(shopOrderItems).values({
			orderId: order.id,
			itemId: item.id,
			quantity: 1,
			pricePointsSnapshot: item.price,
			selectedOptions: options
		});
		if (item.stock !== null) {
			await tx
				.update(shopItems)
				.set({ stock: sql`${shopItems.stock} - 1` })
				.where(eq(shopItems.id, item.id));
		}
		return {
			result: { ok: true, id: order.id, number, points: item.price, repeated: false },
			letter: orderStatusLetter(user, order, deps.siteUrl)
		};
	});
	if (letter) {
		await deps
			.send(letter)
			.catch((e) => console.warn(`order ${input.orderId}: letter not sent`, e));
	}
	return result;
}
