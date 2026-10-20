import { describe, expect, it } from 'vitest';
import { input, session, vposWith, type Reply } from './vpos-support';

/* docs/07 section 4 over the VPOS.am public API (openapi.yaml v0.1.0): no network, fetch is faked. */

describe('VPOS.am provider (docs/07 section 4)', () => {
	it('is the online provider `vpos`, AMD only for now (docs/07 section 13)', () => {
		const { vpos } = vposWith();
		expect(vpos.id).toBe('vpos');
		expect(vpos.online).toBe(true);
		expect([...vpos.currencies]).toEqual(['AMD']);
	});

	it('creates a payment session: our id as the order, a stable idempotency key, one return URL', async () => {
		const { vpos, calls } = vposWith({ status: 201, body: session() });
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
		const { vpos } = vposWith({ status: 200, body: session() });
		expect((await vpos.createPayment(input)).providerPaymentId).toBe('pay_abcdef012345678901');
	});

	it('sends no customer without an email and passes the page language', async () => {
		const { vpos, calls } = vposWith({ status: 201, body: session() });
		await vpos.createPayment({ ...input, payerEmail: undefined, locale: 'hy' });
		const body = calls[0].body as Record<string, unknown>;
		expect(body).not.toHaveProperty('customer');
		expect(body.checkoutLanguage).toBe('hy');
	});

	it('stores the answer without personal data and metadata (docs/07 section 14 p. 2)', async () => {
		const { vpos } = vposWith({ status: 201, body: session({ fiscalReceipt: { crn: 'x' } }) });
		const { raw } = await vpos.createPayment(input);
		const text = JSON.stringify(raw);
		expect(text).not.toContain('member@example.com');
		expect(text).not.toContain('+37400000000');
		expect(text).not.toContain('Membership fee');
		expect(text).not.toContain('crn');
		expect(raw).toMatchObject({ id: 'pay_abcdef012345678901', status: 'pending_redirect' });
	});

	it('refuses a currency it does not take and a bad amount without calling VPOS', async () => {
		const { vpos, calls } = vposWith();
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
		const noPage = vposWith({ status: 201, body: session({ checkoutUrl: undefined }) });
		await expect(noPage.vpos.createPayment(input)).rejects.toMatchObject({ code: 'rejected' });
		const foreign = vposWith({ status: 201, body: session({ merchantOrderId: 'other' }) });
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
			await expect(vposWith(reply).vpos.createPayment(input)).rejects.toMatchObject({ code });
		}
	});

	it('asks the status by the VPOS payment id and converts the amount back', async () => {
		const { vpos, calls } = vposWith({ status: 200, body: session({ status: 'paid' }) });
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
			const { vpos } = vposWith({ status: 200, body: session({ status }) });
			expect((await vpos.getStatus('pay_abcdef012345678901')).status, status).toBe(ours);
		}
	});

	it('status: 404 not_found, an unknown status or broken body unreachable', async () => {
		await expect(vposWith({ status: 404 }).vpos.getStatus('pay_x')).rejects.toMatchObject({
			code: 'not_found'
		});
		const odd = vposWith({ status: 200, body: session({ status: 'teleported' }) });
		await expect(odd.vpos.getStatus('pay_x')).rejects.toMatchObject({ code: 'unreachable' });
		const broken = vposWith({ status: 200, body: [] });
		await expect(broken.vpos.getStatus('pay_x')).rejects.toMatchObject({ code: 'unreachable' });
	});
});
