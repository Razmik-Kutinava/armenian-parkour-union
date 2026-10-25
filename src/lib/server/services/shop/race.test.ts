import { afterAll, describe, expect, it } from 'vitest';
import type { LimitDb } from '../../auth/rate-limit';
import { testDbUrl } from '../../db/test-db';
import { ledgerSum } from '../points/test-support';
import { placeOrder, type PlaceOrderInput } from './checkout';
import { shopRaceDb } from './race-support';
import { balanceOf, ledgerOf, mailbox, orderInput, ordersOf, stockOf } from './test-support';

/* docs/03 section 9 item 3, roadmap 7.8: two orders at the same moment. The order locks the member
 * row, then the item row, so the second one sees the first: the last piece goes once, the points
 * are spent once, the balance never goes below zero. These tests commit (shop/race-support.ts). */

describe.skipIf(!testDbUrl)('shop: simultaneous orders', () => {
	const db = shopRaceDb();
	afterAll(db.cleanup);

	const order = (userId: string, input: PlaceOrderInput) => (tx: LimitDb) =>
		placeOrder(tx, userId, input, mailbox());

	async function spentOnce(userId: string, left: number) {
		expect(await ordersOf(db.main, userId)).toHaveLength(1);
		expect((await ledgerOf(db.main, userId)).filter((e) => e.reason === 'shop_order')).toHaveLength(
			1
		);
		expect(await balanceOf(db.main, userId)).toBe(left);
		expect(await ledgerSum(db.main, userId)).toBe(left);
	}

	it('the last piece ordered by two members at once: one order, stock 0, the other out of stock', async () => {
		const item = await db.item({ pricePoints: 100, stock: 1 });
		const [a, b] = [await db.buyer(), await db.buyer()];
		const results = await db.race(order(a, orderInput(item.id)), order(b, orderInput(item.id)));
		expect(results[0]).toMatchObject({ ok: true, points: 100, repeated: false });
		expect(results[1]).toEqual({ ok: false, reason: 'out_of_stock' });
		expect(await stockOf(db.main, item.id)).toBe(0);
		await spentOnce(a, 50);
		expect(await ordersOf(db.main, b)).toHaveLength(0);
		expect(await balanceOf(db.main, b)).toBe(150);
		expect(await ledgerOf(db.main, b)).toHaveLength(1);
	});

	it('one confirmation sent twice at once: one order, one write-off, the repeat gets it back', async () => {
		const item = await db.item({ pricePoints: 100, stock: 2 });
		const member = await db.buyer();
		const input = orderInput(item.id);
		const [first, second] = await db.race(order(member, input), order(member, input));
		expect(first).toMatchObject({ ok: true, id: input.orderId, repeated: false });
		expect(second).toEqual({ ...first, repeated: true });
		expect(await stockOf(db.main, item.id)).toBe(1);
		await spentOnce(member, 50);
	});

	it('points for one order only, two items at once: one order, the other short, balance not below 0', async () => {
		const [tee, cap] = [await db.item({ pricePoints: 100 }), await db.item({ pricePoints: 120 })];
		const member = await db.buyer(150);
		const results = await db.race(
			order(member, orderInput(tee.id)),
			order(member, orderInput(cap.id))
		);
		expect(results[0]).toMatchObject({ ok: true, points: 100 });
		expect(results[1]).toEqual({ ok: false, reason: 'short', missing: 70 });
		expect(await stockOf(db.main, tee.id)).toBe(1);
		expect(await stockOf(db.main, cap.id)).toBe(2);
		await spentOnce(member, 50);
	});
});
