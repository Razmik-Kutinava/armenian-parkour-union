import { eq } from 'drizzle-orm';
import { afterAll, describe, expect, it } from 'vitest';
import type { LimitDb } from '../../auth/rate-limit';
import { shopItems } from '../../db/schema/shop';
import { users } from '../../db/schema/users';
import { insertUser, testDb, testDbUrl } from '../../db/test-db';
import { orderButton } from './order-button';

/* docs/06 section 4.7 (button table), docs/03 section 9 items 1 and 3; decisions — docs/todo.md 7.5 (4). */

async function addItem(tx: LimitDb, values: Partial<typeof shopItems.$inferInsert> = {}) {
	const [row] = await tx
		.insert(shopItems)
		.values({
			slug: `t-shop-${crypto.randomUUID().slice(0, 8)}`,
			title: { en: 'Tee' },
			pricePoints: 100,
			status: 'published',
			...values
		})
		.returning();
	return row;
}

const member = async (tx: LimitDb, pointsBalance: number, emailVerified = true) =>
	(await insertUser(tx, { pointsBalance, emailVerified })).id;

describe.skipIf(!testDbUrl)('shop: order button state', () => {
	const { inRollback, close } = testDb();
	afterAll(close);

	it('a guest is asked to log in', async () => {
		await inRollback(async (tx) => {
			const item = await addItem(tx);
			expect(await orderButton(tx, null, item.id)).toEqual({ state: 'guest' });
		});
	});

	it('out of stock wins for everyone, the guest included', async () => {
		await inRollback(async (tx) => {
			const item = await addItem(tx, { stock: 0 });
			expect(await orderButton(tx, null, item.id)).toEqual({ state: 'out_of_stock' });
			expect(await orderButton(tx, await member(tx, 500), item.id)).toEqual({
				state: 'out_of_stock'
			});
		});
	});

	it('an unconfirmed email cannot order (docs/03 section 9 item 3)', async () => {
		await inRollback(async (tx) => {
			const item = await addItem(tx);
			expect(await orderButton(tx, await member(tx, 500, false), item.id)).toEqual({
				state: 'email_unverified'
			});
		});
	});

	it('too few points: how many are missing', async () => {
		await inRollback(async (tx) => {
			const item = await addItem(tx, { pricePoints: 100 });
			expect(await orderButton(tx, await member(tx, 40), item.id)).toEqual({
				state: 'short',
				missing: 60
			});
			expect(await orderButton(tx, await member(tx, 0), item.id)).toEqual({
				state: 'short',
				missing: 100
			});
		});
	});

	it('enough points and stock (or no limit): order for the price', async () => {
		await inRollback(async (tx) => {
			const limited = await addItem(tx, { pricePoints: 100, stock: 1 });
			const unlimited = await addItem(tx, { pricePoints: 250, stock: null });
			const id = await member(tx, 250);
			expect(await orderButton(tx, id, limited.id)).toEqual({ state: 'can_order', price: 100 });
			expect(await orderButton(tx, id, unlimited.id)).toEqual({ state: 'can_order', price: 250 });
		});
	});

	it('reads stock and balance now: a change shows without any cache', async () => {
		await inRollback(async (tx) => {
			const item = await addItem(tx, { stock: 2 });
			const id = await member(tx, 100);
			expect(await orderButton(tx, id, item.id)).toEqual({ state: 'can_order', price: 100 });
			await tx.update(users).set({ pointsBalance: 99 }).where(eq(users.id, id));
			expect(await orderButton(tx, id, item.id)).toEqual({ state: 'short', missing: 1 });
			await tx.update(shopItems).set({ stock: 0 }).where(eq(shopItems.id, item.id));
			expect(await orderButton(tx, id, item.id)).toEqual({ state: 'out_of_stock' });
		});
	});

	it('a hidden, deleted or unknown item, or a deleted user, has no order button', async () => {
		await inRollback(async (tx) => {
			const id = await member(tx, 500);
			const draft = await addItem(tx, { status: 'draft' });
			const deleted = await addItem(tx, { deletedAt: new Date() });
			expect(await orderButton(tx, id, draft.id)).toEqual({ state: 'none' });
			expect(await orderButton(tx, id, deleted.id)).toEqual({ state: 'none' });
			expect(await orderButton(tx, id, 'not-a-uuid')).toEqual({ state: 'none' });
			const item = await addItem(tx);
			await tx.update(users).set({ deletedAt: new Date() }).where(eq(users.id, id));
			expect(await orderButton(tx, id, item.id)).toEqual({ state: 'guest' });
		});
	});
});
