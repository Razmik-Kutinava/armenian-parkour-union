import { describe, expect, it } from 'vitest';
import { commentSchema, exportQuerySchema, manualPaymentSchema } from './admin-payments';

/* docs/07 section 9, docs/05 section 16: the manual payment form, checked on the server. */

const TODAY = new Date('2026-10-20T21:30:00Z'); // already 21 October in Yerevan
const schema = manualPaymentSchema(TODAY);

const donation = (extra: Record<string, string> = {}) => ({
	kind: 'donation',
	amount: '25000',
	currency: 'AMD',
	paidOn: '2026-10-01',
	comment: ' Transfer #1 ',
	donorName: 'Cash Donor',
	...extra
});

const errorOf = (input: Record<string, string>) => {
	const result = schema.safeParse(input);
	return result.success ? null : Object.fromEntries(result.error.issues.map((i) => [i.path[0], i.message]));
};

describe('manual payment form', () => {
	it('guest donation: amount in minor units, trimmed comment, empty optional fields as null', () => {
		expect(schema.parse(donation())).toEqual({
			kind: 'donation',
			amountMinor: 25_000,
			currency: 'AMD',
			paidOn: '2026-10-01',
			comment: 'Transfer #1',
			payerEmail: null,
			donorName: 'Cash Donor',
			donorEmail: null,
			isAnonymous: false,
			purposeId: null
		});
	});

	it('cents for USD; anonymity and purpose kept for a donation', () => {
		const purposeId = crypto.randomUUID();
		const parsed = schema.parse(
			donation({ currency: 'USD', amount: '12.5', isAnonymous: 'on', purposeId, donorEmail: 'A@B.am' })
		);
		expect(parsed).toMatchObject({ amountMinor: 1250, isAnonymous: true, purposeId, donorEmail: 'a@b.am' });
	});

	it('fee: the payer email is required; donor fields and purpose are dropped', () => {
		expect(errorOf(donation({ kind: 'membership' }))).toEqual({ payerEmail: 'payments.error.payer' });
		const parsed = schema.parse(
			donation({ kind: 'membership', payerEmail: 'Member@Example.com', purposeId: crypto.randomUUID() })
		);
		expect(parsed).toMatchObject({
			payerEmail: 'member@example.com',
			donorName: null,
			donorEmail: null,
			purposeId: null,
			isAnonymous: false
		});
	});

	it('donation without a member needs the donor name', () => {
		expect(errorOf(donation({ donorName: '' }))).toEqual({ donorName: 'payments.error.donorName' });
		expect(schema.parse(donation({ donorName: '', payerEmail: 'm@example.com' }))).toMatchObject({
			donorName: null
		});
	});

	it('refusals: kind, amount, currency, date in the future or broken, comment', () => {
		expect(errorOf(donation({ kind: 'event_fee' }))).toHaveProperty('kind');
		for (const amount of ['0', '-5', '1.5', 'abc', '']) {
			expect(errorOf(donation({ amount })), amount).toHaveProperty('amount', 'payments.error.amount');
		}
		expect(errorOf(donation({ currency: 'RUB' }))).toHaveProperty('currency');
		expect(errorOf(donation({ paidOn: '2026-10-22' }))).toEqual({ paidOn: 'payments.error.date' });
		expect(errorOf(donation({ paidOn: '2026-02-30' }))).toEqual({ paidOn: 'payments.error.date' });
		expect(schema.parse(donation({ paidOn: '2026-10-21' })).paidOn).toBe('2026-10-21');
		expect(errorOf(donation({ comment: '   ' }))).toEqual({ comment: 'auth.error.required' });
	});
});

describe('comment and export query', () => {
	it('a comment is required and limited', () => {
		expect(commentSchema.safeParse({ comment: ' ok ' }).data).toEqual({ comment: 'ok' });
		expect(commentSchema.safeParse({ comment: '' }).success).toBe(false);
		expect(commentSchema.safeParse({ comment: 'x'.repeat(1001) }).success).toBe(false);
	});

	it('export: kind is a fee or a donation', () => {
		expect(exportQuerySchema.safeParse({ kind: 'membership' }).success).toBe(true);
		expect(exportQuerySchema.safeParse({ kind: 'event_fee' }).success).toBe(false);
		expect(exportQuerySchema.safeParse({}).success).toBe(false);
	});
});
