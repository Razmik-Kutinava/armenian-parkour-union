import { describe, expect, it } from 'vitest';
import { createMockProvider } from './mock';
import type { CreatePaymentInput, WebhookRequest } from './types';

/* docs/07 section 4: mock imitates payment and webhooks so the chain runs without a bank. */

const input: CreatePaymentInput = {
	paymentId: '0b9f3c1e-5d4a-4c2b-9e8f-1a2b3c4d5e6f',
	amountMinor: 5000,
	currency: 'AMD',
	description: 'Membership fee',
	successUrl: 'http://localhost:5173/payment/success?pid=1',
	cancelUrl: 'http://localhost:5173/payment/cancel?pid=1',
	locale: 'ru'
};

function tampered(request: WebhookRequest, body: string): WebhookRequest {
	return { headers: request.headers, body };
}

describe('mock payment provider (docs/07 section 4)', () => {
	it('is an online provider for AMD, USD and EUR', () => {
		const mock = createMockProvider();
		expect(mock.id).toBe('mock');
		expect(mock.online).toBe(true);
		expect([...mock.currencies].sort()).toEqual(['AMD', 'EUR', 'USD']);
	});

	it('creates a pending payment with our amount and a checkout page on our site', async () => {
		const mock = createMockProvider();
		const created = await mock.createPayment(input);
		expect(created.providerPaymentId).toMatch(/^mock_/);
		expect(created.checkoutUrl).toBe(
			`http://localhost:5173/dev/mock-pay/${created.providerPaymentId}`
		);
		const state = await mock.getStatus(created.providerPaymentId);
		expect(state).toMatchObject({ status: 'pending', amountMinor: 5000, currency: 'AMD' });
	});

	it('gives each payment its own provider id', async () => {
		const mock = createMockProvider();
		const a = await mock.createPayment(input);
		const b = await mock.createPayment(input);
		expect(a.providerPaymentId).not.toBe(b.providerPaymentId);
	});

	it('refuses a currency it does not take and an amount that is not a positive integer', async () => {
		const mock = createMockProvider();
		await expect(
			mock.createPayment({ ...input, currency: 'GBP' as CreatePaymentInput['currency'] })
		).rejects.toMatchObject({ code: 'unsupported_currency' });
		for (const amountMinor of [0, -100, 10.5, Number.NaN]) {
			await expect(mock.createPayment({ ...input, amountMinor })).rejects.toMatchObject({
				code: 'invalid_amount'
			});
		}
	});

	it('does not know a payment it never created', async () => {
		const mock = createMockProvider();
		await expect(mock.getStatus('mock_unknown')).rejects.toMatchObject({ code: 'not_found' });
		expect(() => mock.simulate('mock_unknown', 'paid')).toThrow();
	});

	it('simulated payment changes the status and sends a signed webhook with the same data', async () => {
		const mock = createMockProvider();
		const { providerPaymentId } = await mock.createPayment(input);
		const request = mock.simulate(providerPaymentId, 'paid');
		expect((await mock.getStatus(providerPaymentId)).status).toBe('paid');
		const notice = await mock.parseWebhook(request);
		expect(notice).toMatchObject({
			providerPaymentId,
			status: 'paid',
			amountMinor: 5000,
			currency: 'AMD'
		});
		expect(notice?.eventId).toBeTruthy();
	});

	it('can send another amount or currency, to check the mismatch path', async () => {
		const mock = createMockProvider();
		const { providerPaymentId } = await mock.createPayment(input);
		const notice = await mock.parseWebhook(
			mock.simulate(providerPaymentId, 'paid', { amountMinor: 100, currency: 'USD' })
		);
		expect(notice).toMatchObject({ amountMinor: 100, currency: 'USD' });
	});

	it('each event has its own id; the same request read twice keeps it (deduplication)', async () => {
		const mock = createMockProvider();
		const { providerPaymentId } = await mock.createPayment(input);
		const first = mock.simulate(providerPaymentId, 'paid');
		const second = mock.simulate(providerPaymentId, 'paid');
		const a = await mock.parseWebhook(first);
		const again = await mock.parseWebhook(first);
		const b = await mock.parseWebhook(second);
		expect(again?.eventId).toBe(a?.eventId);
		expect(b?.eventId).not.toBe(a?.eventId);
	});

	it('rejects a webhook without a valid signature, with a changed body or broken JSON', async () => {
		const mock = createMockProvider();
		const { providerPaymentId } = await mock.createPayment(input);
		const request = mock.simulate(providerPaymentId, 'paid');
		const forged = request.body.replace('5000', '1');
		const noSignature: WebhookRequest = { headers: new Headers(), body: request.body };
		const badSignature: WebhookRequest = {
			headers: new Headers({ 'x-mock-signature': '00'.repeat(32) }),
			body: request.body
		};
		const shortSignature: WebhookRequest = {
			headers: new Headers({ 'x-mock-signature': 'abc' }),
			body: request.body
		};
		expect(forged).not.toBe(request.body);
		expect(await mock.parseWebhook(noSignature)).toBeNull();
		expect(await mock.parseWebhook(badSignature)).toBeNull();
		expect(await mock.parseWebhook(shortSignature)).toBeNull();
		expect(await mock.parseWebhook(tampered(request, forged))).toBeNull();
		expect(await mock.parseWebhook(tampered(request, '{not json'))).toBeNull();
	});

	it('rejects a correctly signed body that is not a payment notice', async () => {
		const mock = createMockProvider({ secret: 'test-secret' });
		const body = JSON.stringify({ hello: 'world' });
		const { createHmac } = await import('node:crypto');
		const signature = createHmac('sha256', 'test-secret').update(body).digest('hex');
		const request = { headers: new Headers({ 'x-mock-signature': signature }), body };
		expect(await mock.parseWebhook(request)).toBeNull();
	});

	it('rejects a webhook signed by another mock (another server process)', async () => {
		const ours = createMockProvider();
		const theirs = createMockProvider();
		const { providerPaymentId } = await theirs.createPayment(input);
		expect(await ours.parseWebhook(theirs.simulate(providerPaymentId, 'paid'))).toBeNull();
	});

	it('refunds a paid payment only', async () => {
		const mock = createMockProvider();
		const { providerPaymentId } = await mock.createPayment(input);
		expect((await mock.refund(providerPaymentId, 5000, 'duplicate')).ok).toBe(false);
		mock.simulate(providerPaymentId, 'paid');
		expect((await mock.refund(providerPaymentId, 4000, 'partial')).ok).toBe(false);
		expect((await mock.refund(providerPaymentId, 5000, 'duplicate')).ok).toBe(true);
		expect((await mock.getStatus(providerPaymentId)).status).toBe('refunded');
	});
});
