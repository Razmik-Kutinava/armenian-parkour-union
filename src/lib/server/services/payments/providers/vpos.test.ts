import { describe, expect, it } from 'vitest';
import type { CreatePaymentInput } from './types';
import { createVposProvider } from './vpos';

/* docs/07 section 4 over the VPOS.am public API (openapi.yaml v0.1.0): no network, fetch is faked. */

type Call = { url: string; method: string; headers: Headers; body: unknown };
type Reply = { status: number; body?: unknown } | Error;

function fakeFetch(...replies: Reply[]) {
	const calls: Call[] = [];
	const fetch = (async (url: string | URL, init: RequestInit = {}) => {
		calls.push({
			url: String(url),
			method: init.method ?? 'GET',
			headers: new Headers(init.headers),
			body: init.body ? JSON.parse(String(init.body)) : undefined
		});
		const reply = replies.shift() ?? { status: 500 };
		if (reply instanceof Error) throw reply;
		return new Response(reply.body === undefined ? null : JSON.stringify(reply.body), {
			status: reply.status,
			headers: { 'content-type': 'application/json' }
		});
	}) as typeof globalThis.fetch;
	return { fetch, calls };
}

const provider = (...replies: Reply[]) => {
	const fake = fakeFetch(...replies);
	const vpos = createVposProvider({
		token: 'test-token',
		webhookSecret: 'whsec',
		livemode: false,
		fetch: fake.fetch
	});
	return { vpos, calls: fake.calls };
};

const input: CreatePaymentInput = {
	paymentId: '0b9f3c1e-5d4a-4c2b-9e8f-1a2b3c4d5e6f',
	amountMinor: 5000,
	currency: 'AMD',
	description: 'Membership fee',
	successUrl: 'https://parkour.am/ru/payment/success?pid=0b9f3c1e-5d4a-4c2b-9e8f-1a2b3c4d5e6f',
	cancelUrl: 'https://parkour.am/ru/payment/cancel?pid=0b9f3c1e-5d4a-4c2b-9e8f-1a2b3c4d5e6f',
	locale: 'ru',
	payerEmail: 'member@example.com'
};

/* 5000 AMD in VPOS minor units under ISO 4217 (two decimals) — open question in docs/questions.md. */
const session = (over: Record<string, unknown> = {}) => ({
	ok: true,
	id: 'pay_abcdef012345678901',
	merchantOrderId: input.paymentId,
	provider: 'ameriabank_vpos',
	amountMinor: 500000,
	currency: 'AMD',
	status: 'pending_redirect',
	fiscalStatus: 'not_required',
	checkoutUrl: 'https://checkout.vpos.am/s/abc',
	customer: { email: 'member@example.com', phone: '+37400000000', name: 'Test Buyer' },
	metadata: { description: 'Membership fee' },
	createdAt: '2026-10-20T10:00:00.000Z',
	updatedAt: '2026-10-20T10:00:00.000Z',
	...over
});

describe('VPOS.am provider (docs/07 section 4)', () => {
	it('is the online provider `vpos`, AMD only for now (docs/07 section 13)', () => {
		const { vpos } = provider();
		expect(vpos.id).toBe('vpos');
		expect(vpos.online).toBe(true);
		expect([...vpos.currencies]).toEqual(['AMD']);
	});

	it('creates a payment session: our id as the order, a stable idempotency key, one return URL', async () => {
		const { vpos, calls } = provider({ status: 201, body: session() });
		const created = await vpos.createPayment(input);
		expect(calls).toHaveLength(1);
		const [call] = calls;
		expect(call.method).toBe('POST');
		expect(call.url).toBe('https://api.vpos.am/v1/payment-sessions');
		expect(call.headers.get('authorization')).toBe('Bearer test-token');
		expect(call.headers.get('content-type')).toBe('application/json');
		expect(call.headers.get('idempotency-key')).toBe(`payment-${input.paymentId}`);
		expect(call.body).toEqual({
			merchantOrderId: input.paymentId,
			amountMinor: 500000,
			currency: 'AMD',
			returnUrl: input.successUrl,
			checkoutLanguage: 'ru',
			customer: { email: 'member@example.com' },
			metadata: { description: 'Membership fee' }
		});
		expect(created.providerPaymentId).toBe('pay_abcdef012345678901');
		expect(created.checkoutUrl).toBe('https://checkout.vpos.am/s/abc');
	});

	it('an idempotent replay (200) gives the same session', async () => {
		const { vpos } = provider({ status: 200, body: session() });
		expect((await vpos.createPayment(input)).providerPaymentId).toBe('pay_abcdef012345678901');
	});

	it('sends no customer without an email and passes the page language', async () => {
		const { vpos, calls } = provider({ status: 201, body: session() });
		await vpos.createPayment({ ...input, payerEmail: undefined, locale: 'hy' });
		const body = calls[0].body as Record<string, unknown>;
		expect(body).not.toHaveProperty('customer');
		expect(body.checkoutLanguage).toBe('hy');
	});

	it('stores the answer without personal data and metadata (docs/07 section 14 p. 2)', async () => {
		const { vpos } = provider({ status: 201, body: session({ fiscalReceipt: { crn: 'x' } }) });
		const { raw } = await vpos.createPayment(input);
		const text = JSON.stringify(raw);
		expect(text).not.toContain('member@example.com');
		expect(text).not.toContain('+37400000000');
		expect(text).not.toContain('Membership fee');
		expect(text).not.toContain('crn');
		expect(raw).toMatchObject({ id: 'pay_abcdef012345678901', status: 'pending_redirect' });
	});

	it('refuses a currency it does not take and a bad amount without calling VPOS', async () => {
		const { vpos, calls } = provider();
		await expect(vpos.createPayment({ ...input, currency: 'USD' })).rejects.toMatchObject({
			code: 'unsupported_currency'
		});
		for (const amountMinor of [0, -1, 10.5, Number.NaN]) {
			await expect(vpos.createPayment({ ...input, amountMinor })).rejects.toMatchObject({
				code: 'invalid_amount'
			});
		}
		expect(calls).toHaveLength(0);
	});

	it('a session without a checkout page or with a foreign order is rejected', async () => {
		const noPage = provider({ status: 201, body: session({ checkoutUrl: undefined }) });
		await expect(noPage.vpos.createPayment(input)).rejects.toMatchObject({ code: 'rejected' });
		const foreign = provider({ status: 201, body: session({ merchantOrderId: 'other' }) });
		await expect(foreign.vpos.createPayment(input)).rejects.toMatchObject({ code: 'rejected' });
	});

	it('maps HTTP errors: 409 / 422 rejected; 401, 429, 5xx, network unreachable', async () => {
		const cases: [Reply, string][] = [
			[{ status: 409, body: { ok: false, errors: { key: 'conflict' } } }, 'rejected'],
			[{ status: 422, body: { ok: false, errors: { amountMinor: 'invalid' } } }, 'rejected'],
			[{ status: 401 }, 'unreachable'],
			[{ status: 429 }, 'unreachable'],
			[{ status: 503 }, 'unreachable'],
			[new TypeError('fetch failed'), 'unreachable'],
			[{ status: 201, body: 'not a session' }, 'unreachable']
		];
		for (const [reply, code] of cases) {
			await expect(provider(reply).vpos.createPayment(input)).rejects.toMatchObject({ code });
		}
	});

	it('asks the status by the VPOS payment id and converts the amount back', async () => {
		const { vpos, calls } = provider({ status: 200, body: session({ status: 'paid' }) });
		const state = await vpos.getStatus('pay_abcdef012345678901');
		expect(calls[0].method).toBe('GET');
		expect(calls[0].url).toBe('https://api.vpos.am/v1/payments?paymentId=pay_abcdef012345678901');
		expect(calls[0].headers.get('authorization')).toBe('Bearer test-token');
		expect(state).toMatchObject({ status: 'paid', amountMinor: 5000, currency: 'AMD' });
		expect(JSON.stringify(state.raw)).not.toContain('member@example.com');
	});

	it('maps every VPOS status to ours; partial refunds and disputes are left to an admin', async () => {
		const expected: Record<string, string> = {
			created: 'pending',
			pending_redirect: 'pending',
			pending_payment: 'pending',
			authorized: 'pending',
			status_unknown: 'pending',
			paid: 'paid',
			failed: 'failed',
			cancelled: 'cancelled',
			expired: 'cancelled',
			refunded: 'refunded',
			reversed: 'refunded',
			partially_refunded: 'pending',
			disputed: 'pending'
		};
		for (const [status, ours] of Object.entries(expected)) {
			const { vpos } = provider({ status: 200, body: session({ status }) });
			expect((await vpos.getStatus('pay_abcdef012345678901')).status, status).toBe(ours);
		}
	});

	it('status: 404 not_found, an unknown status or broken body unreachable', async () => {
		await expect(provider({ status: 404 }).vpos.getStatus('pay_x')).rejects.toMatchObject({
			code: 'not_found'
		});
		const odd = provider({ status: 200, body: session({ status: 'teleported' }) });
		await expect(odd.vpos.getStatus('pay_x')).rejects.toMatchObject({ code: 'unreachable' });
		const broken = provider({ status: 200, body: [] });
		await expect(broken.vpos.getStatus('pay_x')).rejects.toMatchObject({ code: 'unreachable' });
	});

	it('a payment id with odd characters is escaped in the query and the path', async () => {
		const paid = { status: 200, body: session({ id: 'pay/1&x', status: 'paid' }) };
		const { vpos, calls } = provider(paid, paid, { status: 200, body: { ok: true, operation: {} } });
		await vpos.getStatus('pay/1&x');
		expect(calls[0].url).toBe('https://api.vpos.am/v1/payments?paymentId=pay%2F1%26x');
		await vpos.refund('pay/1&x', 5000, 'reason');
		expect(calls[2].url).toBe('https://api.vpos.am/v1/payments/pay%2F1%26x/refunds');
	});

	it('refunds the full amount in the payment currency with a stable key and the reason', async () => {
		const { vpos, calls } = provider(
			{ status: 200, body: session({ status: 'paid' }) },
			{ status: 200, body: { ok: true, operation: { status: 'succeeded' } } }
		);
		const result = await vpos.refund('pay_abcdef012345678901', 5000, 'Duplicate payment');
		expect(result.ok).toBe(true);
		const refund = calls[1];
		expect(refund.method).toBe('POST');
		expect(refund.url).toBe('https://api.vpos.am/v1/payments/pay_abcdef012345678901/refunds');
		expect(refund.headers.get('idempotency-key')).toBe('refund-pay_abcdef012345678901');
		expect(refund.body).toEqual({
			amountMinor: 500000,
			currency: 'AMD',
			reason: 'Duplicate payment'
		});
	});

	it('cuts the refund reason to the VPOS limit of 240 characters', async () => {
		const { vpos, calls } = provider(
			{ status: 200, body: session({ status: 'paid' }) },
			{ status: 200, body: { ok: true, operation: {} } }
		);
		await vpos.refund('pay_abcdef012345678901', 5000, 'x'.repeat(500));
		expect((calls[1].body as { reason: string }).reason).toHaveLength(240);
	});

	it('202 means the money went back and only the receipt needs an operator', async () => {
		const { vpos } = provider(
			{ status: 200, body: session({ status: 'paid' }) },
			{ status: 202, body: { ok: true, operation: { status: 'needs_review' } } }
		);
		expect((await vpos.refund('pay_abcdef012345678901', 5000, 'r')).ok).toBe(true);
	});

	it('a refused refund (409, 422, 501) is not ok; a network failure throws', async () => {
		for (const status of [409, 422, 501]) {
			const { vpos } = provider(
				{ status: 200, body: session({ status: 'paid' }) },
				{ status, body: { ok: false, errors: { refund: 'no' } } }
			);
			expect((await vpos.refund('pay_abcdef012345678901', 5000, 'r')).ok, String(status)).toBe(
				false
			);
		}
		const down = provider(
			{ status: 200, body: session({ status: 'paid' }) },
			new TypeError('fetch failed')
		);
		await expect(down.vpos.refund('pay_abcdef012345678901', 5000, 'r')).rejects.toThrow();
	});

	it('does not refund another amount than VPOS holds for the payment', async () => {
		const { vpos, calls } = provider({ status: 200, body: session({ status: 'paid' }) });
		expect((await vpos.refund('pay_abcdef012345678901', 4000, 'partial')).ok).toBe(false);
		expect(calls).toHaveLength(1);
	});
});
