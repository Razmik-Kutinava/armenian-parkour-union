import { and, eq } from 'drizzle-orm';
import { afterAll, describe, expect, it } from 'vitest';
import { translate } from '#lib/i18n/translate.ts';
import type { LimitDb } from '../../auth/rate-limit';
import type { UserRole } from '../../auth/session';
import { auditLog } from '../../db/schema/service';
import { shopOrderItems, shopOrders } from '../../db/schema/shop';
import { users } from '../../db/schema/users';
import { insertUser, testDb, testDbUrl } from '../../db/test-db';
import { placeOrder } from './checkout';
import { cancelOrder, staffCanCancel } from './order-cancel';
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

/* docs/03 section 9 item 5, docs/05 section 15, docs/04 section 3.2, docs/03 section 14;
 * decisions — docs/todo.md 7.6 (5, 6, 8). A second refund under a race is 7.8. */

const IP = '10.0.0.9';
const deps = () => ({ ...mailbox(), ip: IP });

async function staff(tx: LimitDb, role: UserRole = 'admin') {
	const { id } = await insertUser(tx, { role });
	return { id, role };
}

async function placed(tx: LimitDb, stock: number | null = 2) {
	const item = await addItem(tx, { pricePoints: 100, stock });
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

describe.skipIf(!testDbUrl)('shop: cancelling an order with a refund', () => {
	const { inRollback, close } = testDb();
	afterAll(close);

	it('an admin cancels a new order: refund entry, balance and stock back, audit, a letter', async () => {
		await inRollback(async (tx) => {
			const { item, member, orderId } = await placed(tx);
			const admin = await staff(tx);
			const d = deps();
			expect(await cancelOrder(tx, admin, orderId, d)).toBe('ok');
			const order = await orderOf(tx, orderId);
			expect(order.status).toBe('cancelled');
			expect(await balanceOf(tx, member)).toBe(150);
			expect(await stockOf(tx, item.id)).toBe(2);

			const refund = (await ledgerOf(tx, member)).find((e) => e.reason === 'shop_refund');
			expect(refund).toMatchObject({
				delta: 100,
				sourceType: 'shop_order',
				sourceId: orderId,
				createdBy: admin.id
			});
			const [entry] = await cancelAudit(tx, orderId);
			expect(entry).toMatchObject({ actorId: admin.id, entityType: 'shop_order', ip: IP });
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
		});
	});

	it('a confirmed order can be cancelled; shipped, delivered and cancelled cannot', async () => {
		await inRollback(async (tx) => {
			const admin = await staff(tx);
			const confirmed = await placed(tx);
			await tx
				.update(shopOrders)
				.set({ status: 'confirmed' })
				.where(eq(shopOrders.id, confirmed.orderId));
			expect(await cancelOrder(tx, admin, confirmed.orderId, deps())).toBe('ok');
			expect(await cancelOrder(tx, admin, confirmed.orderId, deps())).toBe('bad_status');
			expect(await balanceOf(tx, confirmed.member)).toBe(150);

			for (const status of ['shipped', 'delivered'] as const) {
				const o = await placed(tx);
				await tx.update(shopOrders).set({ status }).where(eq(shopOrders.id, o.orderId));
				const d = deps();
				expect(await cancelOrder(tx, admin, o.orderId, d)).toBe('bad_status');
				expect((await orderOf(tx, o.orderId)).status).toBe(status);
				expect(await balanceOf(tx, o.member)).toBe(50);
				expect(await stockOf(tx, o.item.id)).toBe(1);
				expect(d.sent).toHaveLength(0);
			}
		});
	});

	it('a moderator, an editor or a member may not cancel; nothing changes', async () => {
		await inRollback(async (tx) => {
			const { item, member, orderId } = await placed(tx);
			for (const role of ['moderator', 'editor', 'member'] as const) {
				expect(await cancelOrder(tx, await staff(tx, role), orderId, deps())).toBe('not_allowed');
			}
			expect((await orderOf(tx, orderId)).status).toBe('new');
			expect(await balanceOf(tx, member)).toBe(50);
			expect(await stockOf(tx, item.id)).toBe(1);
			expect(await cancelAudit(tx, orderId)).toHaveLength(0);
		});
	});

	it('no stock limit stays unlimited; several pieces go back to the stock', async () => {
		await inRollback(async (tx) => {
			const admin = await staff(tx);
			const unlimited = await placed(tx, null);
			expect(await cancelOrder(tx, admin, unlimited.orderId, deps())).toBe('ok');
			expect(await stockOf(tx, unlimited.item.id)).toBeNull();

			const many = await placed(tx, 5);
			await tx
				.update(shopOrderItems)
				.set({ quantity: 3 })
				.where(eq(shopOrderItems.orderId, many.orderId));
			expect(await cancelOrder(tx, admin, many.orderId, deps())).toBe('ok');
			expect(await stockOf(tx, many.item.id)).toBe(7);
		});
	});

	it('a deleted account: cancelled and stock back, no refund, no letter', async () => {
		await inRollback(async (tx) => {
			const { item, member, orderId } = await placed(tx);
			await tx.update(users).set({ deletedAt: new Date() }).where(eq(users.id, member));
			const admin = await staff(tx);
			const d = deps();
			expect(await cancelOrder(tx, admin, orderId, d)).toBe('ok');
			expect((await orderOf(tx, orderId)).status).toBe('cancelled');
			expect(await stockOf(tx, item.id)).toBe(2);
			expect((await ledgerOf(tx, member)).map((e) => e.reason)).toEqual(['shop_order']);
			expect((await cancelAudit(tx, orderId))[0].after).toMatchObject({ refund: 0 });
			expect(d.sent).toHaveLength(0);
		});
	});

	it('an order without a write-off entry refunds nothing', async () => {
		await inRollback(async (tx) => {
			const member = await buyer(tx, { pointsBalance: 0 });
			const [order] = await tx
				.insert(shopOrders)
				.values({
					number: `ORD-2099-T${crypto.randomUUID().slice(0, 8)}`,
					userId: member,
					totalPoints: 100,
					recipientName: 'Ani',
					phone: '+37491000000',
					city: 'Gyumri',
					address: 'Rizhkov 5'
				})
				.returning();
			expect(await cancelOrder(tx, await staff(tx), order.id, deps())).toBe('ok');
			expect(await balanceOf(tx, member)).toBe(0);
			expect(await ledgerOf(tx, member)).toHaveLength(0);
		});
	});

	it('an unknown or malformed order is not found', async () => {
		await inRollback(async (tx) => {
			const admin = await staff(tx);
			for (const id of [crypto.randomUUID(), 'nope']) {
				expect(await cancelOrder(tx, admin, id, deps())).toBe('not_found');
			}
		});
	});
});

describe('the cancel button in the order card (docs/05 section 15)', () => {
	it('is offered only before shipping, as the cancel itself checks', () => {
		expect(['new', 'confirmed'].map(staffCanCancel)).toEqual([true, true]);
		expect(['shipped', 'delivered', 'cancelled'].map(staffCanCancel)).toEqual([
			false,
			false,
			false
		]);
	});
});
