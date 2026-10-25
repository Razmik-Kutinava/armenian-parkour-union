import { and, eq } from 'drizzle-orm';
import { afterAll, describe, expect, it } from 'vitest';
import type { LimitDb } from '../../auth/rate-limit';
import { auditLog } from '../../db/schema/service';
import { shopOrders } from '../../db/schema/shop';
import { testDbUrl } from '../../db/test-db';
import { ledgerSum } from '../points/test-support';
import { placeOrder } from './checkout';
import { cancelOrder, cancelOwnOrder } from './order-cancel';
import { changeOrderStatus } from './orders';
import { shopRaceDb } from './race-support';
import { balanceOf, ledgerOf, mailbox, orderInput, ordersOf, stockOf } from './test-support';

/* docs/03 section 9 item 5, question 108, roadmap 7.8: a cancel at the same moment as another
 * cancel, a status change or an order of the same item. Both sides lock the order row (the order —
 * the item row), so the second sees the first: one refund, stock back once. Commits
 * (shop/race-support.ts). */

const deps = () => ({ ...mailbox(), ip: '10.0.0.8' });
type Step = (tx: LimitDb) => Promise<string>;

describe.skipIf(!testDbUrl)('shop: simultaneous cancels', () => {
	const db = shopRaceDb();
	afterAll(db.cleanup);

	async function placed(stock = 2) {
		const item = await db.item({ pricePoints: 100, stock });
		const member = await db.buyer(150);
		const input = orderInput(item.id);
		await placeOrder(db.main, member, input, mailbox());
		const admin = await db.staff('admin');
		const own: Step = (tx) => cancelOwnOrder(tx, member, input.orderId, deps());
		const staff: Step = (tx) => cancelOrder(tx, admin, input.orderId, deps());
		const confirm: Step = (tx) => changeOrderStatus(tx, admin, input.orderId, 'confirmed', deps());
		return { item, member, admin, id: input.orderId, own, staff, confirm };
	}

	const statusOf = async (id: string) =>
		(await db.main.select().from(shopOrders).where(eq(shopOrders.id, id)))[0].status;
	const refunds = async (member: string) =>
		(await ledgerOf(db.main, member)).filter((e) => e.reason === 'shop_refund');
	const cancelLogged = async (id: string) =>
		(
			await db.main
				.select()
				.from(auditLog)
				.where(and(eq(auditLog.action, 'shop_order.cancel'), eq(auditLog.entityId, id)))
		).length;

	for (const memberFirst of [true, false]) {
		it(`member and admin cancel at once, ${memberFirst ? 'member' : 'admin'} first: one refund`, async () => {
			const o = await placed();
			const [a, b] = memberFirst ? [o.own, o.staff] : [o.staff, o.own];
			expect(await db.race(a, b)).toEqual(['ok', 'bad_status']);
			expect(await statusOf(o.id)).toBe('cancelled');
			const back = await refunds(o.member);
			expect(back).toHaveLength(1);
			expect(back[0]).toMatchObject({ delta: 100, createdBy: memberFirst ? null : o.admin.id });
			expect(await balanceOf(db.main, o.member)).toBe(150);
			expect(await ledgerSum(db.main, o.member)).toBe(150);
			expect(await stockOf(db.main, o.item.id)).toBe(2);
			expect(await cancelLogged(o.id)).toBe(1);
		});

		it(`member cancels while admin confirms, ${memberFirst ? 'cancel' : 'confirm'} first: one wins`, async () => {
			const o = await placed();
			const [a, b] = memberFirst ? [o.own, o.confirm] : [o.confirm, o.own];
			expect(await db.race(a, b)).toEqual(['ok', 'bad_status']);
			expect(await statusOf(o.id)).toBe(memberFirst ? 'cancelled' : 'confirmed');
			expect(await refunds(o.member)).toHaveLength(memberFirst ? 1 : 0);
			expect(await balanceOf(db.main, o.member)).toBe(memberFirst ? 150 : 50);
			expect(await stockOf(db.main, o.item.id)).toBe(memberFirst ? 2 : 1);
		});

		it(`the last piece comes back while another member orders it, ${memberFirst ? 'cancel' : 'order'} first`, async () => {
			const o = await placed(1);
			const other = await db.buyer(150);
			const order: Step = async (tx) => {
				const placedNow = await placeOrder(tx, other, orderInput(o.item.id), mailbox());
				return placedNow.ok ? 'ok' : placedNow.reason;
			};
			const results = memberFirst ? await db.race(o.own, order) : await db.race(order, o.own);
			expect(results).toEqual(memberFirst ? ['ok', 'ok'] : ['out_of_stock', 'ok']);
			expect(await statusOf(o.id)).toBe('cancelled');
			expect(await ordersOf(db.main, other)).toHaveLength(memberFirst ? 1 : 0);
			expect(await balanceOf(db.main, other)).toBe(memberFirst ? 50 : 150);
			expect(await stockOf(db.main, o.item.id)).toBe(memberFirst ? 0 : 1);
		});
	}
});
