import { afterAll, describe, expect, it, vi } from 'vitest';
import { testDb, testDbUrl } from '../../db/test-db';
import { createMockProvider } from './providers/mock';
import { manualProvider } from './providers/manual';
import type { OnlineProvider } from './providers/types';
import { paymentRow } from './test-support';
import { receiveWebhook } from './webhook';
import { eventIdOf, startedAtMock, testIp, toRequest, webhookEvents } from './webhook-support';

/* docs/07 sections 6 (p. 1-2.2), 14 (p. 3): what is refused before anything is recorded. */

describe.skipIf(!testDbUrl)('payments: webhook — refused before recording', () => {
	const { inRollback, close } = testDb();
	afterAll(close);

	it('unknown, offline or webhook-less provider: 404', async () => {
		await inRollback(async (tx) => {
			const { mock, providerPaymentId } = await startedAtMock(tx);
			const sent = mock.simulate(providerPaymentId, 'paid');
			const silent: OnlineProvider = { ...createMockProvider(), parseWebhook: undefined };
			for (const provider of [null, manualProvider, silent]) {
				expect(await receiveWebhook(tx, provider, toRequest(sent), { ip: testIp() })).toBe(404);
			}
			expect(await webhookEvents(tx, eventIdOf(sent))).toEqual([]);
		});
	});

	it('wrong signature: 400, no event, payment untouched', async () => {
		await inRollback(async (tx) => {
			const { mock, id, providerPaymentId } = await startedAtMock(tx);
			const sent = mock.simulate(providerPaymentId, 'paid');
			const forged = { headers: sent.headers, body: sent.body.replace('"paid"', '"paid" ') };
			const stranger = createMockProvider();
			expect(await receiveWebhook(tx, mock, toRequest(forged), { ip: testIp() })).toBe(400);
			expect(await receiveWebhook(tx, stranger, toRequest(sent), { ip: testIp() })).toBe(400);
			expect(await webhookEvents(tx, eventIdOf(sent))).toEqual([]);
			expect((await paymentRow(tx, id)).status).toBe('pending');
		});
	});

	it('a provider that throws while parsing: 400', async () => {
		await inRollback(async (tx) => {
			const { mock, providerPaymentId } = await startedAtMock(tx);
			const sent = mock.simulate(providerPaymentId, 'paid');
			const broken: OnlineProvider = {
				...mock,
				parseWebhook: async () => {
					throw new Error('cannot parse');
				}
			};
			expect(await receiveWebhook(tx, broken, toRequest(sent), { ip: testIp() })).toBe(400);
			expect(await webhookEvents(tx, eventIdOf(sent))).toEqual([]);
		});
	});

	it('a body over the limit: 413, the provider never sees it', async () => {
		await inRollback(async (tx) => {
			const { mock, providerPaymentId } = await startedAtMock(tx);
			const sent = mock.simulate(providerPaymentId, 'paid');
			const parse = vi.spyOn(mock, 'parseWebhook');
			const options = { ip: testIp(), maxBytes: sent.body.length - 1 };
			expect(await receiveWebhook(tx, mock, toRequest(sent), options)).toBe(413);
			expect(parse).not.toHaveBeenCalled();
			expect(await webhookEvents(tx, eventIdOf(sent))).toEqual([]);
		});
	});

	it('too many requests from one address: 429, the rest is not even read', async () => {
		await inRollback(async (tx) => {
			const { mock, id, providerPaymentId } = await startedAtMock(tx);
			const options = { ip: testIp(), limit: { windowMs: 60_000, max: 1 } };
			const first = mock.simulate(providerPaymentId, 'failed', { amountMinor: 0 });
			expect(await receiveWebhook(tx, mock, toRequest(first), options)).toBe(200);
			const parse = vi.spyOn(mock, 'parseWebhook');
			const second = mock.simulate(providerPaymentId, 'paid');
			expect(await receiveWebhook(tx, mock, toRequest(second), options)).toBe(429);
			expect(parse).not.toHaveBeenCalled();
			expect((await paymentRow(tx, id)).status).toBe('failed');
			const other = { ...options, ip: testIp() };
			expect(await receiveWebhook(tx, mock, toRequest(second), other)).toBe(200);
		});
	});
});
