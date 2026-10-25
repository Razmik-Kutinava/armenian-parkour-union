import { eq } from 'drizzle-orm';
import { afterAll, describe, expect, it, vi } from 'vitest';
import { translate } from '#lib/i18n/translate.ts';
import { shopItems } from '../../db/schema/shop';
import { testDb, testDbUrl } from '../../db/test-db';
import { placeOrder } from './checkout';
import {
	addItem,
	balanceOf,
	buyer,
	delivery,
	ledgerOf,
	linesOf,
	mailbox,
	nothingWritten,
	NOW,
	orderInput,
	ordersOf,
	SITE,
	stockOf
} from './test-support';

/* docs/03 section 9 items 3 and 6, docs/06 section 4.7, docs/03 section 14; decisions —
 * docs/todo.md 7.6 (1, 2, 4, 6). Refusals — checkout-refusals.test.ts; races on the last item — 7.8. */

describe.skipIf(!testDbUrl)('shop: placing an order', () => {
	const { inRollback, close } = testDb();
	afterAll(close);

	it('one transaction: order, line with the price, points written off, stock down, a letter', async () => {
		await inRollback(async (tx) => {
			const item = await addItem(tx, { pricePoints: 100, stock: 2 });
			const id = await buyer(tx, { pointsBalance: 150 });
			const mail = mailbox();
			const input = orderInput(item.id);
			const result = await placeOrder(tx, id, input, mail, NOW);
			expect(result).toMatchObject({ ok: true, id: input.orderId, points: 100, repeated: false });
			if (!result.ok) return;
			expect(result.number).toMatch(/^ORD-2026-\d{4,}$/);

			const [order] = await ordersOf(tx, id);
			expect(order).toMatchObject({
				id: input.orderId,
				number: result.number,
				status: 'new',
				totalPoints: 100,
				...delivery
			});
			const [entry] = await ledgerOf(tx, id);
			expect(entry).toMatchObject({
				id: order.ledgerId,
				delta: -100,
				reason: 'shop_order',
				sourceType: 'shop_order',
				sourceId: order.id
			});
			const [line] = await linesOf(tx, order.id);
			expect(line).toMatchObject({
				itemId: item.id,
				quantity: 1,
				pricePointsSnapshot: 100,
				selectedOptions: { Size: 'M' }
			});
			expect(await balanceOf(tx, id)).toBe(50);
			expect(await stockOf(tx, item.id)).toBe(1);

			expect(mail.sent).toHaveLength(1);
			expect(mail.sent[0].subject).toBe(
				translate('ru', 'shop.mail.subject', {
					number: result.number,
					status: translate('ru', 'shop.order.status.new')
				})
			);
			expect(mail.sent[0].text).toContain(`${SITE}/ru/cabinet/orders`);
		});
	});

	it('no stock limit stays unlimited; no options stores none; the exact balance goes to 0', async () => {
		await inRollback(async (tx) => {
			const item = await addItem(tx, { pricePoints: 150, stock: null, options: null });
			const id = await buyer(tx);
			const input = orderInput(item.id, { options: {} });
			expect(await placeOrder(tx, id, input, mailbox(), NOW)).toMatchObject({ ok: true });
			expect(await stockOf(tx, item.id)).toBeNull();
			expect(await balanceOf(tx, id)).toBe(0);
			expect((await linesOf(tx, input.orderId))[0].selectedOptions).toBeNull();
		});
	});

	it('the last item: stock goes to 0, the next order is refused', async () => {
		await inRollback(async (tx) => {
			const item = await addItem(tx, { pricePoints: 10, stock: 1 });
			const id = await buyer(tx);
			expect(await placeOrder(tx, id, orderInput(item.id), mailbox(), NOW)).toMatchObject({
				ok: true
			});
			expect(await stockOf(tx, item.id)).toBe(0);
			expect(await placeOrder(tx, id, orderInput(item.id), mailbox(), NOW)).toEqual({
				ok: false,
				reason: 'out_of_stock'
			});
			expect(await ordersOf(tx, id)).toHaveLength(1);
		});
	});

	it('numbers grow within a year; a new Yerevan year starts at 0001', async () => {
		await inRollback(async (tx) => {
			const item = await addItem(tx, { pricePoints: 10, stock: null });
			const id = await buyer(tx);
			const newYear = new Date('2030-12-31T21:30:00Z');
			const first = await placeOrder(tx, id, orderInput(item.id), mailbox(), newYear);
			const second = await placeOrder(tx, id, orderInput(item.id), mailbox(), newYear);
			expect(first).toMatchObject({ ok: true, number: 'ORD-2031-0001' });
			expect(second).toMatchObject({ ok: true, number: 'ORD-2031-0002' });
		});
	});

	it('the price is a snapshot: a later change does not touch the order', async () => {
		await inRollback(async (tx) => {
			const item = await addItem(tx, { pricePoints: 100 });
			const id = await buyer(tx);
			const input = orderInput(item.id);
			await placeOrder(tx, id, input, mailbox(), NOW);
			await tx.update(shopItems).set({ pricePoints: 300 }).where(eq(shopItems.id, item.id));
			expect((await linesOf(tx, input.orderId))[0].pricePointsSnapshot).toBe(100);
			expect((await ordersOf(tx, id))[0].totalPoints).toBe(100);
		});
	});

	it('the same order sent twice is placed once; another member cannot take its id', async () => {
		await inRollback(async (tx) => {
			const item = await addItem(tx, { pricePoints: 100, stock: 5 });
			const id = await buyer(tx, { pointsBalance: 500 });
			const input = orderInput(item.id);
			const mail = mailbox();
			const first = await placeOrder(tx, id, input, mail, NOW);
			const again = await placeOrder(tx, id, input, mail, NOW);
			expect(first).toMatchObject({ ok: true, repeated: false });
			expect(again).toMatchObject({ ok: true, repeated: true, id: input.orderId, points: 100 });
			if (!first.ok || !again.ok) return;
			expect(again.number).toBe(first.number);
			expect(await ordersOf(tx, id)).toHaveLength(1);
			expect(await ledgerOf(tx, id)).toHaveLength(1);
			expect(await balanceOf(tx, id)).toBe(400);
			expect(await stockOf(tx, item.id)).toBe(4);
			expect(mail.sent).toHaveLength(1);

			const other = await buyer(tx, { pointsBalance: 500 });
			expect(await placeOrder(tx, other, input, mailbox(), NOW)).toEqual({
				ok: false,
				reason: 'not_found'
			});
			await nothingWritten(tx, other, item.id, 4);
		});
	});

	it('a failed letter does not undo the order', async () => {
		await inRollback(async (tx) => {
			const item = await addItem(tx);
			const id = await buyer(tx);
			const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
			const failing = {
				siteUrl: SITE,
				send: async () => {
					throw new Error('mail is down');
				}
			};
			expect(await placeOrder(tx, id, orderInput(item.id), failing, NOW)).toMatchObject({
				ok: true
			});
			expect(warn).toHaveBeenCalled();
			warn.mockRestore();
			expect(await ordersOf(tx, id)).toHaveLength(1);
			expect(await balanceOf(tx, id)).toBe(50);
		});
	});
});
