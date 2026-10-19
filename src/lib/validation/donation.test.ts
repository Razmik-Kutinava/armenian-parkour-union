import { describe, expect, it } from 'vitest';
import { fieldErrors } from './form';
import { donationSchema } from './donation';

/* docs/06 section 4.8, docs/07 section 5.2: a guest gives name and email; a member's come from the
 * account, so the form cannot set them. The amount range is checked by the service. */

const PURPOSE = '6f1d2c1e-8c2a-4a5b-9d3e-1f2a3b4c5d6e';

describe('validation: donation form', () => {
	it('guest: amount, name, email, optional purpose and the anonymous box', () => {
		const parsed = donationSchema(true).parse({
			amount: ' 10 000 ',
			purposeId: PURPOSE,
			donorName: ' Anna ',
			donorEmail: ' Anna@Example.com ',
			isAnonymous: 'on'
		});
		expect(parsed).toEqual({
			amount: '10000',
			purposeId: PURPOSE,
			donorName: 'Anna',
			donorEmail: 'anna@example.com',
			isAnonymous: true
		});
	});

	it('guest: name and email are required; empty purpose means none', () => {
		const result = donationSchema(true).safeParse({ amount: '5000', purposeId: '' });
		expect(result.success).toBe(false);
		const errors = fieldErrors(result.error!);
		expect(errors.donorName).toBe('auth.error.required');
		expect(errors.donorEmail).toBe('auth.error.email');
		const ok = donationSchema(true).parse({
			amount: '5000',
			purposeId: '',
			donorName: 'A',
			donorEmail: 'a@example.com'
		});
		expect(ok.purposeId).toBeUndefined();
		expect(ok.isAnonymous).toBe(false);
	});

	it('member: name and email from the form are dropped', () => {
		const parsed = donationSchema(false).parse({
			amount: '5000',
			donorName: 'Someone Else',
			donorEmail: 'victim@example.com'
		});
		expect(parsed).toEqual({ amount: '5000', isAnonymous: false });
	});

	it('amount: required, digits only after spaces are removed; purpose must be an id', () => {
		for (const amount of ['', '   ', '-100', '10.5', '1e5', 'abc', '1'.repeat(21)]) {
			const result = donationSchema(false).safeParse({ amount });
			expect(result.success, amount).toBe(false);
			expect(fieldErrors(result.error!).amount, amount).toBe('donate.error.amount');
		}
		const purpose = donationSchema(false).safeParse({ amount: '5000', purposeId: 'x; drop' });
		expect(fieldErrors(purpose.error!).purposeId).toBe('donate.error.purpose');
	});
});
