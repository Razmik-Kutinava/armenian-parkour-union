import { and, eq } from 'drizzle-orm';
import { afterAll, describe, expect, it } from 'vitest';
import { translate } from '#lib/i18n/translate.ts';
import type { LimitDb } from '../../auth/rate-limit';
import { auditLog } from '../../db/schema/service';
import { shopOrders } from '../../db/schema/shop';
import { testDb, testDbUrl } from '../../db/test-db';
import { placeOrder } from './checkout';
import { cancelOwnOrder } from './order-cancel';
import {
	addItem,
	balanceOf,
	buyer,
	ledgerOf,
	mailbox,
	NOW,
	orderInput,
	stockOf
} from './test-support';

/* docs/06 section 5.8, docs/03 section 9 item 5; question 108 (decisions.md 2026-10-25): the member
 * cancels only a `new` order. Decisions — docs/todo.md 7.7 (4). A race with the admin is 7.8. */

const IP = '10.0.0.7';
const deps = () => ({ ...mailbox(), ip: IP });

async function placed(tx: LimitDb) {
	const item = await addItem(tx, { pricePoints: 100, stock: 2 });
	const member = await buyer(tx, { pointsBalance: 150 });
	const input = orderInput(item.id);
	await placeOrder(tx, member, input, mailbox(), NOW);
	return { item, member, orderId: input.orderId };
}

const orderOf = async (tx: LimitDb, id: string) =>
	(await tx.select().from(shopOrders).where(eq(shopOrders.id, id)))[0];
const cancelAudit = (tx: LimitDb, id: string) =>
	tx
		.select()
		.from(auditLog)
		.where(and(eq(auditLog.action, 'shop_order.cancel'), eq(auditLog.entityId, id)));

describe.skipIf(!testDbUrl)('shop: the member cancels own order', () => {
	const { inRollback, close } = testDb();
	afterAll(close);

	it('a new order: refund without an author, balance and stock back, audit, a letter', async () => {
		await inRollback(async (tx) => {
			const { item, member, orderId } = await placed(tx);
			const d = deps();
			expect(await cancelOwnOrder(tx, member, orderId, d)).toBe('ok');
			const order = await orderOf(tx, orderId);
			expect(order.status).toBe('cancelled');
			expect(await balanceOf(tx, member)).toBe(150);
			expect(await stockOf(tx, item.id)).toBe(2);

			const refund = (await ledgerOf(tx, member)).find((e) => e.reason === 'shop_refund');
			expect(refund).toMatchObject({
				delta: 100,
				sourceType: 'shop_order',
				sourceId: orderId,
				createdBy: null
			});
			const [entry] = await cancelAudit(tx, orderId);
			expect(entry).toMatchObject({ actorId: member, entityType: 'shop_order', ip: IP });
			expect(entry.before).toEqual({ status: 'new' });
			expect(entry.after).toEqual({
				status: 'cancelled',
				number: order.number,
				refund: 100,
				entryId: refund?.id
			});
			expect(d.sent).toHaveLength(1);
			expect(d.sent[0].subject).toBe(
				translate('ru', 'shop.mail.subject', {
					number: order.number,
					status: translate('ru', 'shop.order.status.cancelled')
				})
			);
			expect(await cancelOwnOrder(tx, member, orderId, deps())).toBe('bad_status');
			expect(await balanceOf(tx, member)).toBe(150);
		});
	});

	it('confirmed, shipped, delivered: refused, nothing changes', async () => {
		await inRollback(async (tx) => {
			for (const status of ['confirmed', 'shipped', 'delivered'] as const) {
				const { item, member, orderId } = await placed(tx);
				await tx.update(shopOrders).set({ status }).where(eq(shopOrders.id, orderId));
				const d = deps();
				expect(await cancelOwnOrder(tx, member, orderId, d)).toBe('bad_status');
				expect((await orderOf(tx, orderId)).status).toBe(status);
				expect(await balanceOf(tx, member)).toBe(50);
				expect(await stockOf(tx, item.id)).toBe(1);
				expect(await cancelAudit(tx, orderId)).toHaveLength(0);
				expect(d.sent).toHaveLength(0);
			}
		});
	});

	it("another member's order or a bad id is not found; nothing changes", async () => {
		await inRollback(async (tx) => {
			const { item, member, orderId } = await placed(tx);
			const stranger = await buyer(tx);
			for (const id of [orderId, crypto.randomUUID(), 'nope']) {
				expect(await cancelOwnOrder(tx, stranger, id, deps())).toBe('not_found');
			}
			expect((await orderOf(tx, orderId)).status).toBe('new');
			expect(await balanceOf(tx, member)).toBe(50);
			expect(await stockOf(tx, item.id)).toBe(1);
			expect(await ledgerOf(tx, stranger)).toHaveLength(0);
		});
	});
});
