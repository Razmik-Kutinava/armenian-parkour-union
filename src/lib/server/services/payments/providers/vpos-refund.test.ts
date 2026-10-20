import { describe, expect, it } from 'vitest';
import { paidSession, session, vposWith } from './vpos-support';

/* docs/07 section 11 over VPOS.am refunds: full amount only, refused or failed — the admin sees it. */

const PAY = 'pay_abcdef012345678901';

describe('VPOS.am refund (docs/07 section 11)', () => {
	it('refunds the full amount in the payment currency with a key per attempt and the reason', async () => {
		const { vpos, calls } = vposWith(paidSession, {
			status: 200,
			body: { ok: true, operation: { status: 'succeeded' } }
		});
		expect((await vpos.refund(PAY, 5000, 'Duplicate payment')).ok).toBe(true);
		const refund = calls[1];
		expect(refund.method).toBe('POST');
		expect(refund.url).toBe(`https://api.vpos.am/v1/payments/${PAY}/refunds`);
		expect(refund.headers.get('authorization')).toBe('Bearer test-token');
		expect(refund.headers.get('idempotency-key')).toMatch(new RegExp(`^refund-${PAY}-\\d+$`));
		expect(refund.body).toEqual({
			amountMinor: 500000,
			currency: 'AMD',
			reason: 'Duplicate payment'
		});
	});

	it('a payment id with odd characters is escaped in the query and the path', async () => {
		const paid = { status: 200, body: session({ id: 'pay/1&x', status: 'paid' }) };
		const { vpos, calls } = vposWith(paid, { status: 200, body: { ok: true, operation: {} } });
		await vpos.refund('pay/1&x', 5000, 'reason');
		expect(calls[0].url).toBe('https://api.vpos.am/v1/payments?paymentId=pay%2F1%26x');
		expect(calls[1].url).toBe('https://api.vpos.am/v1/payments/pay%2F1%26x/refunds');
	});

	it('cuts the refund reason to the VPOS limit of 240 characters', async () => {
		const { vpos, calls } = vposWith(paidSession, {
			status: 200,
			body: { ok: true, operation: {} }
		});
		await vpos.refund(PAY, 5000, 'x'.repeat(500));
		expect((calls[1].body as { reason: string }).reason).toHaveLength(240);
	});

	it('202 means the money went back and only the receipt needs an operator', async () => {
		const { vpos } = vposWith(paidSession, {
			status: 202,
			body: { ok: true, operation: { status: 'needs_review' } }
		});
		expect((await vpos.refund(PAY, 5000, 'r')).ok).toBe(true);
	});

	it('a refused refund (409, 422, 501) is not ok; a network failure throws', async () => {
		for (const status of [409, 422, 501]) {
			const { vpos } = vposWith(paidSession, { status, body: { ok: false, errors: { r: 'no' } } });
			expect((await vpos.refund(PAY, 5000, 'r')).ok, String(status)).toBe(false);
		}
		const down = vposWith(paidSession, new TypeError('fetch failed'));
		await expect(down.vpos.refund(PAY, 5000, 'r')).rejects.toThrow();
	});

	it('does not refund another amount than VPOS holds for the payment', async () => {
		const { vpos, calls } = vposWith(paidSession);
		expect((await vpos.refund(PAY, 4000, 'partial')).ok).toBe(false);
		expect(calls).toHaveLength(1);
	});
});
