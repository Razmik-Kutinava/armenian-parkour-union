import { eq } from 'drizzle-orm';
import { expect } from 'vitest';
import type { LimitDb } from '../../auth/rate-limit';
import { pointsLedger } from '../../db/schema/points';
import { shopItems, shopOrderItems, shopOrders } from '../../db/schema/shop';
import { users } from '../../db/schema/users';
import { insertUser } from '../../db/test-db';
import type { Mail } from '../../mail/resend';
import type { PlaceOrderInput } from './checkout';

/* Rows and inputs for the order service tests (checkout, cancel). */

export const SITE = 'https://parkour.test';
export const NOW = new Date('2026-10-25T10:00:00+04:00');

export function mailbox() {
	const sent: Mail[] = [];
	return { sent, send: async (mail: Mail) => void sent.push(mail), siteUrl: SITE };
}

export async function addItem(tx: LimitDb, values: Partial<typeof shopItems.$inferInsert> = {}) {
	const [row] = await tx
		.insert(shopItems)
		.values({
			slug: `t-shop-${crypto.randomUUID().slice(0, 8)}`,
			title: { en: 'Tee' },
			pricePoints: 100,
			stock: 2,
			options: { Size: ['S', 'M'] },
			status: 'published',
			...values
		})
		.returning();
	return row;
}

export const buyer = async (tx: LimitDb, values: Partial<typeof users.$inferInsert> = {}) =>
	(await insertUser(tx, { pointsBalance: 150, emailVerified: true, locale: 'ru', ...values })).id;

export const delivery = {
	recipientName: 'Ani Petrosyan',
	phone: '+37491000000',
	city: 'Gyumri',
	address: 'Rizhkov 5',
	comment: 'Call first'
};

export const orderInput = (
	itemId: string,
	values: Partial<PlaceOrderInput> = {}
): PlaceOrderInput => ({
	orderId: crypto.randomUUID(),
	itemId,
	options: { Size: 'M' },
	delivery,
	...values
});

export const balanceOf = async (tx: LimitDb, id: string) =>
	(await tx.select({ b: users.pointsBalance }).from(users).where(eq(users.id, id)))[0].b;
export const stockOf = async (tx: LimitDb, id: string) =>
	(await tx.select({ s: shopItems.stock }).from(shopItems).where(eq(shopItems.id, id)))[0].s;
export const ordersOf = (tx: LimitDb, userId: string) =>
	tx.select().from(shopOrders).where(eq(shopOrders.userId, userId));
export const ledgerOf = (tx: LimitDb, userId: string) =>
	tx.select().from(pointsLedger).where(eq(pointsLedger.userId, userId));
export const linesOf = (tx: LimitDb, orderId: string) =>
	tx.select().from(shopOrderItems).where(eq(shopOrderItems.orderId, orderId));

/** A refused order leaves no order, no ledger entry and the stock as it was. */
export async function nothingWritten(
	tx: LimitDb,
	userId: string,
	itemId: string,
	stock: number | null
) {
	expect(await ordersOf(tx, userId)).toHaveLength(0);
	expect(await ledgerOf(tx, userId)).toHaveLength(0);
	expect(await stockOf(tx, itemId)).toBe(stock);
}
