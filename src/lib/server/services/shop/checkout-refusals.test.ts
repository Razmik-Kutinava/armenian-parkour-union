import { eq } from 'drizzle-orm';
import { afterAll, describe, expect, it } from 'vitest';
import { users } from '../../db/schema/users';
import { testDb, testDbUrl } from '../../db/test-db';
import { placeOrder } from './checkout';
import {
	addItem,
	balanceOf,
	buyer,
	linesOf,
	mailbox,
	nothingWritten,
	NOW,
	orderInput
} from './test-support';

/* docs/03 section 9 items 1 and 3, docs/06 section 4.7 (button order); decisions —
 * docs/todo.md 7.6 (2, 3). A refused order writes nothing. */

describe.skipIf(!testDbUrl)('shop: an order is refused', () => {
	const { inRollback, close } = testDb();
	afterAll(close);

	it('too few points, an unconfirmed email, no stock', async () => {
		await inRollback(async (tx) => {
			const item = await addItem(tx, { pricePoints: 100, stock: 2 });
			const empty = await addItem(tx, { stock: 0 });
			const poor = await buyer(tx, { pointsBalance: 40 });
			expect(await placeOrder(tx, poor, orderInput(item.id), mailbox(), NOW)).toEqual({
				ok: false,
				reason: 'short',
				missing: 60
			});
			await nothingWritten(tx, poor, item.id, 2);
			expect(await balanceOf(tx, poor)).toBe(40);

			const unverified = await buyer(tx, { emailVerified: false });
			expect(await placeOrder(tx, unverified, orderInput(item.id), mailbox(), NOW)).toEqual({
				ok: false,
				reason: 'email_unverified'
			});
			await nothingWritten(tx, unverified, item.id, 2);

			const rich = await buyer(tx);
			expect(await placeOrder(tx, rich, orderInput(empty.id), mailbox(), NOW)).toEqual({
				ok: false,
				reason: 'out_of_stock'
			});
			await nothingWritten(tx, rich, empty.id, 0);
			expect(await balanceOf(tx, rich)).toBe(150);
		});
	});

	it('options: every name of the item, a value from its list, nothing extra', async () => {
		await inRollback(async (tx) => {
			const item = await addItem(tx, { options: { Size: ['S', 'M'], Color: ['Red'] } });
			const id = await buyer(tx);
			const bad = [
				{ Size: 'M' },
				{ Size: 'XL', Color: 'Red' },
				{ Size: 'M', Color: 'Red', Fit: 'Slim' },
				{ Size: '', Color: 'Red' }
			];
			for (const options of bad) {
				const r = await placeOrder(tx, id, orderInput(item.id, { options }), mailbox(), NOW);
				expect(r).toEqual({ ok: false, reason: 'options_invalid' });
			}
			await nothingWritten(tx, id, item.id, 2);
			const good = orderInput(item.id, { options: { Size: 'S', Color: 'Red' } });
			expect(await placeOrder(tx, id, good, mailbox(), NOW)).toMatchObject({ ok: true });
			expect((await linesOf(tx, good.orderId))[0].selectedOptions).toEqual({
				Size: 'S',
				Color: 'Red'
			});
		});
	});

	it('a blocked or deleted member, a hidden, deleted or unknown item cannot be ordered', async () => {
		await inRollback(async (tx) => {
			const item = await addItem(tx);
			const blocked = await buyer(tx, { status: 'blocked' });
			expect(await placeOrder(tx, blocked, orderInput(item.id), mailbox(), NOW)).toEqual({
				ok: false,
				reason: 'not_allowed'
			});
			const gone = await buyer(tx, { deletedAt: new Date() });
			expect(await placeOrder(tx, gone, orderInput(item.id), mailbox(), NOW)).toEqual({
				ok: false,
				reason: 'not_found'
			});
			const id = await buyer(tx);
			const draft = await addItem(tx, { status: 'draft' });
			const archived = await addItem(tx, { status: 'archived' });
			const deleted = await addItem(tx, { deletedAt: new Date() });
			for (const itemId of [draft.id, archived.id, deleted.id, crypto.randomUUID(), 'nope']) {
				expect(await placeOrder(tx, id, orderInput(itemId), mailbox(), NOW)).toEqual({
					ok: false,
					reason: 'not_found'
				});
			}
			const badId = orderInput(item.id, { orderId: 'nope' });
			expect(await placeOrder(tx, id, badId, mailbox(), NOW)).toEqual({
				ok: false,
				reason: 'not_found'
			});
			expect(await placeOrder(tx, 'nope', orderInput(item.id), mailbox(), NOW)).toEqual({
				ok: false,
				reason: 'not_found'
			});
			await nothingWritten(tx, id, item.id, 2);
		});
	});

	it('the balance is read under the lock, not from the caller', async () => {
		await inRollback(async (tx) => {
			const item = await addItem(tx, { pricePoints: 100 });
			const id = await buyer(tx, { pointsBalance: 150 });
			await tx.update(users).set({ pointsBalance: 99 }).where(eq(users.id, id));
			expect(await placeOrder(tx, id, orderInput(item.id), mailbox(), NOW)).toEqual({
				ok: false,
				reason: 'short',
				missing: 1
			});
		});
	});
});
