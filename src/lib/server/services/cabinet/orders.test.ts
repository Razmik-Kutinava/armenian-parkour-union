import { afterAll, describe, expect, it } from 'vitest';
import type { LimitDb } from '../../auth/rate-limit';
import { shopOrderItems, shopOrders } from '../../db/schema/shop';
import { insertUser, testDb, testDbUrl } from '../../db/test-db';
import { addItem, delivery } from '../shop/test-support';
import { getOwnOrder, listOwnOrders } from './orders';

/* docs/06 section 5.8: number, lines, total, status, date; the card — delivery and the shipping
 * note; only the member's own (docs/04 section 5.3). Decisions — docs/todo.md 7.7 (3). */

type Status = 'new' | 'confirmed' | 'shipped' | 'delivered' | 'cancelled';

async function addOrder(
	tx: LimitDb,
	userId: string,
	itemId: string,
	values: { status?: Status; createdAt?: Date; trackingNote?: string } = {}
) {
	const [order] = await tx
		.insert(shopOrders)
		.values({
			number: `ORD-2099-T${crypto.randomUUID().slice(0, 8)}`,
			userId,
			totalPoints: 120,
			...delivery,
			...values
		})
		.returning();
	await tx.insert(shopOrderItems).values({
		orderId: order.id,
		itemId,
		selectedOptions: { Size: 'M' },
		quantity: 1,
		pricePointsSnapshot: 120
	});
	return order;
}

describe.skipIf(!testDbUrl)('cabinet: own orders', () => {
	const { inRollback, close } = testDb();
	afterAll(close);

	it('lists own orders, newest first, with lines and the price snapshot', async () => {
		await inRollback(async (tx) => {
			const item = await addItem(tx, { title: { en: 'Tee', ru: 'Футболка' } });
			const { id: member } = await insertUser(tx);
			const { id: other } = await insertUser(tx);
			const older = await addOrder(tx, member, item.id, {
				status: 'delivered',
				createdAt: new Date('2026-10-01T10:00:00Z')
			});
			const newer = await addOrder(tx, member, item.id);
			await addOrder(tx, other, item.id);

			const list = await listOwnOrders(tx, member);
			expect(list.map((o) => o.id)).toEqual([newer.id, older.id]);
			expect(list[0]).toMatchObject({
				number: newer.number,
				status: 'new',
				totalPoints: 120,
				lines: [
					{
						itemId: item.id,
						title: { en: 'Tee', ru: 'Футболка' },
						quantity: 1,
						pricePointsSnapshot: 120,
						selectedOptions: { Size: 'M' }
					}
				]
			});
			expect(list[0]).not.toHaveProperty('memberName');
			expect(list[0]).not.toHaveProperty('phone');
		});
	});

	it('the card: delivery, shipping note and whether the member may cancel', async () => {
		await inRollback(async (tx) => {
			const item = await addItem(tx);
			const { id: member } = await insertUser(tx);
			const fresh = await addOrder(tx, member, item.id);
			const shipped = await addOrder(tx, member, item.id, {
				status: 'shipped',
				trackingNote: 'HayPost RR123'
			});

			expect(await getOwnOrder(tx, member, fresh.id)).toMatchObject({
				number: fresh.number,
				status: 'new',
				...delivery,
				trackingNote: null,
				canCancel: true,
				lines: [expect.objectContaining({ itemId: item.id })]
			});
			expect(await getOwnOrder(tx, member, shipped.id)).toMatchObject({
				status: 'shipped',
				trackingNote: 'HayPost RR123',
				canCancel: false
			});
		});
	});

	it('only new orders may be cancelled by the member', async () => {
		await inRollback(async (tx) => {
			const item = await addItem(tx);
			const { id: member } = await insertUser(tx);
			for (const status of ['confirmed', 'delivered', 'cancelled'] as const) {
				const order = await addOrder(tx, member, item.id, { status });
				expect(await getOwnOrder(tx, member, order.id)).toMatchObject({ canCancel: false });
			}
		});
	});

	it("another member's order, an unknown or a bad id is not found", async () => {
		await inRollback(async (tx) => {
			const item = await addItem(tx);
			const { id: member } = await insertUser(tx);
			const { id: other } = await insertUser(tx);
			const foreign = await addOrder(tx, other, item.id);
			for (const id of [foreign.id, crypto.randomUUID(), 'nope']) {
				expect(await getOwnOrder(tx, member, id)).toBeNull();
			}
			expect(await listOwnOrders(tx, 'nope')).toEqual([]);
		});
	});
});
