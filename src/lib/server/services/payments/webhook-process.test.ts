import { afterAll, describe, expect, it } from 'vitest';
import { testDb, testDbUrl } from '../../db/test-db';
import { paymentWebhookEvents } from '../../db/schema/payments';
import { countingEffects } from './apply-support';
import type { PaymentEffects } from './effects';
import { createMockProvider } from './providers/mock';
import { auditOf, paymentRow } from './test-support';
import { receiveWebhook } from './webhook';
import { eventIdOf, startedAtMock, testIp, toRequest, webhookEvents } from './webhook-support';

/* docs/07 sections 6 (p. 2.3-2.8, 3-5), 15: recording, dedup, amount check, retries. */

const failing: PaymentEffects = {
	membership: {
		paid: async () => {
			throw new Error('effect failed');
		}
	}
};

describe.skipIf(!testDbUrl)('payments: webhook — recording and processing', () => {
	const { inRollback, close } = testDb();
	afterAll(close);

	it('paid: 200, payment paid with effects, event recorded and marked processed', async () => {
		await inRollback(async (tx) => {
			const { mock, id, providerPaymentId } = await startedAtMock(tx);
			const { calls, effects } = countingEffects();
			const sent = mock.simulate(providerPaymentId, 'paid');
			expect(await receiveWebhook(tx, mock, toRequest(sent), { ip: testIp(), effects })).toBe(200);
			expect((await paymentRow(tx, id)).status).toBe('paid');
			expect(calls).toEqual(['paid:paid']);
			const [event] = await webhookEvents(tx, eventIdOf(sent));
			expect(event).toMatchObject({ provider: 'mock', error: null, payload: JSON.parse(sent.body) });
			expect(event.processedAt).toBeInstanceOf(Date);
		});
	});

	it('the same webhook twice: 200 both times, one event, effects and audit once', async () => {
		await inRollback(async (tx) => {
			const { mock, id, providerPaymentId } = await startedAtMock(tx);
			const { calls, effects } = countingEffects();
			const sent = mock.simulate(providerPaymentId, 'paid');
			for (let i = 0; i < 2; i++) {
				expect(await receiveWebhook(tx, mock, toRequest(sent), { ip: testIp(), effects })).toBe(200);
			}
			expect(await webhookEvents(tx, eventIdOf(sent))).toHaveLength(1);
			expect(calls).toEqual(['paid:paid']);
			expect(await auditOf(tx, id)).toHaveLength(1);
		});
	});

	it('the same event id from another provider is a different event', async () => {
		await inRollback(async (tx) => {
			const { mock, providerPaymentId } = await startedAtMock(tx);
			const sent = mock.simulate(providerPaymentId, 'paid');
			await tx
				.insert(paymentWebhookEvents)
				.values({ provider: 'other', eventId: eventIdOf(sent), payload: {} });
			expect(await receiveWebhook(tx, mock, toRequest(sent), { ip: testIp() })).toBe(200);
			const events = await webhookEvents(tx, eventIdOf(sent));
			expect(events.map((e) => [e.provider, e.processedAt !== null]).sort()).toEqual([
				['mock', true],
				['other', false]
			]);
		});
	});

	it('amount or currency differ: 200, payment failed for review, no effects, error in the event', async () => {
		await inRollback(async (tx) => {
			for (const override of [{ amountMinor: 1 }, { currency: 'USD' }]) {
				const { mock, id, providerPaymentId } = await startedAtMock(tx);
				const { calls, effects } = countingEffects();
				const sent = mock.simulate(providerPaymentId, 'paid', override);
				expect(await receiveWebhook(tx, mock, toRequest(sent), { ip: testIp(), effects })).toBe(
					200
				);
				expect(await paymentRow(tx, id)).toMatchObject({
					status: 'failed',
					failureReason: 'amount_mismatch',
					needsReview: true
				});
				expect(calls).toEqual([]);
				const [event] = await webhookEvents(tx, eventIdOf(sent));
				expect(event).toMatchObject({ error: 'amount_mismatch', processedAt: expect.any(Date) });
			}
		});
	});

	it('unknown payment: 200 so the provider stops, error kept in the event', async () => {
		await inRollback(async (tx) => {
			const mock = createMockProvider();
			const created = await mock.createPayment({
				paymentId: crypto.randomUUID(),
				amountMinor: 100,
				currency: 'AMD',
				description: 'Not ours',
				successUrl: 'https://parkour.test/payment/success',
				cancelUrl: 'https://parkour.test/payment/cancel',
				locale: 'en'
			});
			const sent = mock.simulate(created.providerPaymentId, 'paid');
			expect(await receiveWebhook(tx, mock, toRequest(sent), { ip: testIp() })).toBe(200);
			const [event] = await webhookEvents(tx, eventIdOf(sent));
			expect(event).toMatchObject({ error: 'payment_not_found', processedAt: expect.any(Date) });
		});
	});

	it('a late paid after refunded: 200, payment stays refunded, the event says ignored', async () => {
		await inRollback(async (tx) => {
			const { mock, id, providerPaymentId } = await startedAtMock(tx);
			const paid = mock.simulate(providerPaymentId, 'paid');
			const refunded = mock.simulate(providerPaymentId, 'refunded');
			const latePaid = mock.simulate(providerPaymentId, 'paid');
			for (const sent of [paid, refunded, latePaid]) {
				expect(await receiveWebhook(tx, mock, toRequest(sent), { ip: testIp() })).toBe(200);
			}
			expect((await paymentRow(tx, id)).status).toBe('refunded');
			const [event] = await webhookEvents(tx, eventIdOf(latePaid));
			expect(event.error).toBe('transition_ignored');
		});
	});

	it('processing fails: 500, event kept with the error; the retry processes it', async () => {
		await inRollback(async (tx) => {
			const { mock, id, providerPaymentId } = await startedAtMock(tx);
			const sent = mock.simulate(providerPaymentId, 'paid');
			const ip = testIp();
			expect(await receiveWebhook(tx, mock, toRequest(sent), { ip, effects: failing })).toBe(500);
			expect((await paymentRow(tx, id)).status).toBe('pending');
			const [failed] = await webhookEvents(tx, eventIdOf(sent));
			expect(failed).toMatchObject({ error: 'effect failed', processedAt: null });

			const { calls, effects } = countingEffects();
			expect(await receiveWebhook(tx, mock, toRequest(sent), { ip, effects })).toBe(200);
			expect((await paymentRow(tx, id)).status).toBe('paid');
			expect(calls).toEqual(['paid:paid']);
			const [retried] = await webhookEvents(tx, eventIdOf(sent));
			expect(retried).toMatchObject({ error: null, processedAt: expect.any(Date) });
		});
	});
});
