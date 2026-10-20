import { createHmac } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import type { WebhookRequest } from './types';
import { createVposProvider } from './vpos';

/* docs/07 sections 4, 6, 14 p. 3 over the VPOS.am webhook `payment.status_changed`. */

const SECRET = 'whsec_test_0123456789';
const NOW = new Date('2026-10-20T10:00:00.000Z');
const nowSeconds = Math.floor(NOW.getTime() / 1000);

const vpos = (options: { livemode?: boolean; now?: Date } = {}) =>
	createVposProvider({
		token: 'test-token',
		webhookSecret: SECRET,
		livemode: options.livemode ?? false,
		fetch: (() => {
			throw new Error('a webhook must not call VPOS');
		}) as typeof globalThis.fetch,
		now: () => options.now ?? NOW
	});

const event = (payment: Record<string, unknown> = {}, over: Record<string, unknown> = {}) => ({
	id: 'evt_0123456789abcdef',
	type: 'payment.status_changed',
	livemode: false,
	createdAt: '2026-10-20T09:59:58.000Z',
	trigger: 'provider_callback',
	data: {
		payment: {
			id: 'pay_abcdef012345678901',
			merchantOrderId: '0b9f3c1e-5d4a-4c2b-9e8f-1a2b3c4d5e6f',
			provider: 'ameriabank_vpos',
			amountMinor: 500000,
			currency: 'AMD',
			status: 'paid',
			fiscalStatus: 'not_required',
			...payment
		}
	},
	...over
});

const hmac = (secret: string, t: number, body: string) =>
	createHmac('sha256', secret).update(`${t}.${body}`).digest('hex');

function signed(
	body: unknown,
	{
		t = nowSeconds,
		secret = SECRET,
		signature
	}: { t?: number; secret?: string; signature?: string } = {}
): WebhookRequest {
	const text = typeof body === 'string' ? body : JSON.stringify(body);
	const headers = new Headers({
		'content-type': 'application/json',
		'x-vpos-signature': signature ?? `t=${t},v1=${hmac(secret, t, text)}`,
		'x-vpos-event-id': 'evt_0123456789abcdef',
		'x-vpos-event-type': 'payment.status_changed',
		'x-vpos-webhook-timestamp': String(t)
	});
	return { headers, body: text };
}

describe('VPOS.am webhook (docs/07 sections 4, 6)', () => {
	it('a signed event becomes a notice with our amount and the event id for deduplication', async () => {
		const notice = await vpos().parseWebhook(signed(event()));
		expect(notice).toMatchObject({
			eventId: 'evt_0123456789abcdef',
			providerPaymentId: 'pay_abcdef012345678901',
			status: 'paid',
			amountMinor: 5000,
			currency: 'AMD'
		});
	});

	it('maps statuses like a status check; a waiting status is a notice without a change', async () => {
		const cases: Record<string, string> = {
			failed: 'failed',
			expired: 'cancelled',
			reversed: 'refunded',
			pending_payment: 'pending',
			partially_refunded: 'pending'
		};
		for (const [status, ours] of Object.entries(cases)) {
			const notice = await vpos().parseWebhook(signed(event({ status })));
			expect(notice?.status, status).toBe(ours);
		}
	});

	it('keeps only the safe fields of the event (docs/07 section 14 p. 2)', async () => {
		const body = event(
			{ customer: { email: 'member@example.com', phone: '+37400000000' }, metadata: { a: 1 } },
			{ extra: 'secret-ish' }
		);
		const notice = await vpos().parseWebhook(signed(body));
		const text = JSON.stringify(notice?.raw);
		expect(text).not.toContain('member@example.com');
		expect(text).not.toContain('+37400000000');
		expect(text).not.toContain('secret-ish');
		expect(notice?.raw).toMatchObject({
			id: 'evt_0123456789abcdef',
			type: 'payment.status_changed',
			livemode: false,
			payment: { id: 'pay_abcdef012345678901', status: 'paid', amountMinor: 500000 }
		});
	});

	it('rejects a missing, wrong or malformed signature and a changed body', async () => {
		const request = signed(event());
		const forged = { headers: request.headers, body: request.body.replace('500000', '100') };
		const none = { headers: new Headers(), body: request.body };
		const cases: WebhookRequest[] = [
			forged,
			none,
			signed(event(), { secret: 'another-secret' }),
			signed(event(), { signature: `t=${nowSeconds},v1=${'0'.repeat(64)}` }),
			signed(event(), { signature: `t=${nowSeconds},v1=abc` }),
			signed(event(), { signature: `v1=${hmac(SECRET, nowSeconds, request.body)}` }),
			signed(event(), { signature: 'garbage' })
		];
		for (const [i, bad] of cases.entries()) {
			expect(await vpos().parseWebhook(bad), `case ${i}`).toBeNull();
		}
	});

	it('the signature covers the timestamp: another t with the same v1 is rejected', async () => {
		const body = JSON.stringify(event());
		const v1 = hmac(SECRET, nowSeconds, body);
		const request = signed(body, { signature: `t=${nowSeconds - 1},v1=${v1}` });
		expect(await vpos().parseWebhook(request)).toBeNull();
	});

	it('accepts any of several v1 values (secret rotation)', async () => {
		const body = JSON.stringify(event());
		const good = hmac(SECRET, nowSeconds, body);
		const old = hmac('old-secret', nowSeconds, body);
		const request = signed(body, { signature: `t=${nowSeconds},v1=${old},v1=${good}` });
		expect(await vpos().parseWebhook(request)).not.toBeNull();
	});

	it('rejects an event older or newer than five minutes (replay)', async () => {
		expect(await vpos().parseWebhook(signed(event(), { t: nowSeconds - 301 }))).toBeNull();
		expect(await vpos().parseWebhook(signed(event(), { t: nowSeconds + 301 }))).toBeNull();
		expect(await vpos().parseWebhook(signed(event(), { t: nowSeconds - 299 }))).not.toBeNull();
	});

	it('rejects a test event on the live provider and a live event on the test one', async () => {
		expect(await vpos({ livemode: true }).parseWebhook(signed(event()))).toBeNull();
		const live = signed(event({}, { livemode: true }));
		expect(await vpos({ livemode: false }).parseWebhook(live)).toBeNull();
		expect(await vpos({ livemode: true }).parseWebhook(live)).not.toBeNull();
	});

	it('rejects a signed body that is not a payment status event or not JSON', async () => {
		const cases: unknown[] = [
			'{not json',
			{ hello: 'world' },
			event({}, { type: 'payment.created' }),
			event({ status: 'teleported' }),
			event({ amountMinor: 10.5 }),
			event({ id: '' }),
			event({}, { id: '' })
		];
		for (const [i, body] of cases.entries()) {
			expect(await vpos().parseWebhook(signed(body)), `case ${i}`).toBeNull();
		}
	});
});
