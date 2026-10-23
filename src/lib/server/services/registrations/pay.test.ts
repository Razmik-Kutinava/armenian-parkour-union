import { eq } from 'drizzle-orm';
import { afterAll, describe, expect, it } from 'vitest';
import { events } from '../../db/schema/events';
import { users } from '../../db/schema/users';
import { testDb, testDbUrl } from '../../db/test-db';
import { createMockProvider } from '../payments/providers/mock';
import { paymentRow, paymentsOf, spiedMock, unreachableProvider } from '../payments/test-support';
import { startEventPayment } from './pay';
import { PRICE, expireHold, paidEvent, payDeps } from './pay-support';
import { HOUR, insertEvent, insertMember, registerOk, registrationOf } from './test-support';

/* docs/07 section 5.3 p. 1-2, section 3 p. 1: the amount comes from the event only; the payment
 * waits no longer than the seat is held; a second press goes to the same payment. */

const MINUTE = 60_000;

describe.skipIf(!testDbUrl)('registrations: starting the event fee payment', () => {
	const { inRollback, close } = testDb();
	afterAll(close);

	it('pending event fee linked to the registration; amount and currency from the event', async () => {
		await inRollback(async (tx) => {
			const event = await paidEvent(tx, { priceAmountMinor: 7_500, priceCurrency: 'USD' });
			const member = await insertMember(tx);
			const { id } = await registerOk(tx, member.id, event.id);
			const { mock, calls } = spiedMock();
			const before = Date.now();
			const result = await startEventPayment(tx, member.id, event.id, 'en', payDeps(mock));
			if (!result.ok) throw new Error(result.reason);
			expect(result.reused).toBe(false);
			const payment = await paymentRow(tx, result.paymentId);
			expect(payment).toMatchObject({
				kind: 'event_fee',
				status: 'pending',
				userId: member.id,
				amountMinor: 7_500,
				currency: 'USD',
				membershipId: null
			});
			const wait = payment.expiresAt!.getTime() - before;
			expect(wait).toBeGreaterThan(29 * MINUTE);
			expect(wait).toBeLessThan(31 * MINUTE);
			expect(calls).toMatchObject([{ amountMinor: 7_500, currency: 'USD' }]);
			expect(await registrationOf(tx, id)).toMatchObject({
				status: 'pending_payment',
				paymentId: payment.id
			});
		});
	});

	it('the payment waits no longer than the seat is held, nor longer than payment_wait_minutes', async () => {
		await inRollback(async (tx) => {
			const event = await paidEvent(tx);
			const [a, b] = [await insertMember(tx), await insertMember(tx)];
			await registerOk(tx, a.id, event.id);
			await registerOk(tx, b.id, event.id);
			const mock = createMockProvider();
			const before = Date.now();
			const long = await startEventPayment(tx, a.id, event.id, 'en', {
				...payDeps(mock),
				waitMinutes: 240
			});
			const short = await startEventPayment(tx, b.id, event.id, 'en', {
				...payDeps(mock),
				waitMinutes: 10
			});
			if (!long.ok || !short.ok) throw new Error('not started');
			const longWait = (await paymentRow(tx, long.paymentId)).expiresAt!.getTime() - before;
			const shortWait = (await paymentRow(tx, short.paymentId)).expiresAt!.getTime() - before;
			expect(longWait).toBeLessThan(31 * MINUTE);
			expect(shortWait).toBeGreaterThan(9 * MINUTE);
			expect(shortWait).toBeLessThan(11 * MINUTE);
		});
	});

	it('a second press goes to the same payment; a new price — a new payment, the link moves', async () => {
		await inRollback(async (tx) => {
			const event = await paidEvent(tx);
			const member = await insertMember(tx);
			const { id } = await registerOk(tx, member.id, event.id);
			const deps = payDeps(createMockProvider());
			const first = await startEventPayment(tx, member.id, event.id, 'en', deps);
			const second = await startEventPayment(tx, member.id, event.id, 'en', deps);
			if (!first.ok || !second.ok) throw new Error('not started');
			expect(second).toMatchObject({
				paymentId: first.paymentId,
				checkoutUrl: first.checkoutUrl,
				reused: true
			});
			expect(await paymentsOf(tx, member.id)).toHaveLength(1);

			await tx
				.update(events)
				.set({ priceAmountMinor: PRICE * 2 })
				.where(eq(events.id, event.id));
			const third = await startEventPayment(tx, member.id, event.id, 'en', deps);
			if (!third.ok) throw new Error(third.reason);
			expect(third.paymentId).not.toBe(first.paymentId);
			expect((await paymentRow(tx, third.paymentId)).amountMinor).toBe(PRICE * 2);
			expect((await registrationOf(tx, id)).paymentId).toBe(third.paymentId);
		});
	});

	it('nothing to pay: no registration, free, waitlist, hold over, event closed — refused, nothing created', async () => {
		await inRollback(async (tx) => {
			const deps = payDeps(createMockProvider());
			const paid = await paidEvent(tx, { capacity: 1 });
			const free = await insertEvent(tx);
			const [holder, queued, stranger, guest] = [
				await insertMember(tx),
				await insertMember(tx),
				await insertMember(tx),
				await insertMember(tx)
			];
			const held = await registerOk(tx, holder.id, paid.id);
			await registerOk(tx, queued.id, paid.id);
			await registerOk(tx, guest.id, free.id);
			const refused = (userId: string, eventId: string) =>
				startEventPayment(tx, userId, eventId, 'en', deps);

			expect(await refused(stranger.id, paid.id)).toEqual({ ok: false, reason: 'not_found' });
			expect(await refused(holder.id, crypto.randomUUID())).toMatchObject({ reason: 'not_found' });
			expect(await refused('nope', paid.id)).toMatchObject({ reason: 'not_found' });
			expect(await refused(guest.id, free.id)).toMatchObject({ reason: 'not_pending' });
			expect(await refused(queued.id, paid.id)).toMatchObject({ reason: 'not_pending' });

			await expireHold(tx, held.id);
			expect(await refused(holder.id, paid.id)).toMatchObject({ reason: 'hold_expired' });

			const cancelled = await paidEvent(tx);
			const late = await insertMember(tx);
			await registerOk(tx, late.id, cancelled.id);
			await tx.update(events).set({ status: 'cancelled' }).where(eq(events.id, cancelled.id));
			expect(await refused(late.id, cancelled.id)).toMatchObject({ reason: 'closed' });
			const started = await paidEvent(tx, { startsAt: new Date(Date.now() + HOUR) });
			await registerOk(tx, late.id, started.id);
			await tx
				.update(events)
				.set({ startsAt: new Date(Date.now() - HOUR) })
				.where(eq(events.id, started.id));
			expect(await refused(late.id, started.id)).toMatchObject({ reason: 'closed' });

			for (const user of [holder, queued, stranger, guest, late]) {
				expect(await paymentsOf(tx, user.id)).toEqual([]);
			}
		});
	});

	it('blocked member; no provider or wait time: refused, the registration keeps waiting', async () => {
		await inRollback(async (tx) => {
			const event = await paidEvent(tx);
			const member = await insertMember(tx);
			const { id } = await registerOk(tx, member.id, event.id);
			const provider = createMockProvider();
			for (const deps of [payDeps(null), payDeps(provider, { waitMinutes: null })]) {
				expect(await startEventPayment(tx, member.id, event.id, 'en', deps)).toEqual({
					ok: false,
					reason: 'unavailable'
				});
			}
			await tx.update(users).set({ status: 'blocked' }).where(eq(users.id, member.id));
			expect(
				await startEventPayment(tx, member.id, event.id, 'en', payDeps(provider))
			).toMatchObject({ reason: 'blocked' });
			expect(await paymentsOf(tx, member.id)).toEqual([]);
			expect(await registrationOf(tx, id)).toMatchObject({
				status: 'pending_payment',
				paymentId: null
			});
		});
	});

	it('the provider does not answer: payment failed, the seat still held; a retry starts a new one', async () => {
		await inRollback(async (tx) => {
			const event = await paidEvent(tx);
			const member = await insertMember(tx);
			const { id } = await registerOk(tx, member.id, event.id);
			const down = await startEventPayment(
				tx,
				member.id,
				event.id,
				'en',
				payDeps(unreachableProvider())
			);
			expect(down).toMatchObject({ ok: false, reason: 'provider_error' });
			const [failed] = await paymentsOf(tx, member.id);
			expect(failed).toMatchObject({ status: 'failed', kind: 'event_fee' });
			expect(await registrationOf(tx, id)).toMatchObject({
				status: 'pending_payment',
				paymentId: failed.id
			});

			const retry = await startEventPayment(
				tx,
				member.id,
				event.id,
				'en',
				payDeps(createMockProvider())
			);
			if (!retry.ok) throw new Error(retry.reason);
			expect(retry.paymentId).not.toBe(failed.id);
			expect((await registrationOf(tx, id)).paymentId).toBe(retry.paymentId);
		});
	});
});
