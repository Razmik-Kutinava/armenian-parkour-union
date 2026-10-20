import { describe, expect, it } from 'vitest';
import { parseDonationLimits } from '#lib/server/services/donations/settings.ts';
import { parseMembershipFee, parsePeriodMonths } from '#lib/server/services/memberships/fee.ts';
import { parseWaitMinutes } from '#lib/server/services/payments/settings.ts';
import { fieldErrors } from './form';
import {
	paymentSettingsFormSchema,
	paymentSettingsToForm,
	storedPaymentSettings
} from './payment-settings';

/* docs/05 section 21 "Membership"; decisions.md 2026-10-19 (3.6, 3.7): the keys the payment
 * scenarios read, edited in the admin panel. */

const valid = {
	feeAmount: '20000',
	feeCurrency: 'AMD',
	feePeriodMonths: '12',
	donationCurrency: 'AMD',
	donationMin: '1000',
	donationMax: '1000000',
	waitMinutes: '30'
};

const errorsOf = (form: Record<string, string>) => {
	const r = paymentSettingsFormSchema.safeParse(form);
	return r.success ? {} : fieldErrors(r.error);
};

describe('payment settings form (docs/05 section 21)', () => {
	it('turns the form into the stored keys, read back by the payment scenarios', () => {
		const r = paymentSettingsFormSchema.safeParse(valid);
		expect(r.success && r.data).toEqual({
			membership_fee: { amount_minor: 20_000, currency: 'AMD', period_months: 12 },
			donation_limits: { currency: 'AMD', min_minor: 1000, max_minor: 1_000_000 },
			payment_wait_minutes: 30
		});
		if (!r.success) return;
		expect(parseMembershipFee(r.data.membership_fee)).toEqual({
			amountMinor: 20_000,
			currency: 'AMD',
			periodMonths: 12
		});
		expect(parseDonationLimits(r.data.donation_limits)).toEqual({
			currency: 'AMD',
			minMinor: 1000,
			maxMinor: 1_000_000
		});
		expect(parseWaitMinutes(r.data.payment_wait_minutes)).toBe(30);
	});

	it('amounts are entered in main units of their own currency (main.mdc arch. 3)', () => {
		const r = paymentSettingsFormSchema.safeParse({
			...valid,
			feeAmount: '49.99',
			feeCurrency: 'USD',
			donationCurrency: 'EUR',
			donationMin: '5',
			donationMax: '2000.5'
		});
		expect(r.success && r.data.membership_fee).toEqual({
			amount_minor: 4999,
			currency: 'USD',
			period_months: 12
		});
		expect(r.success && r.data.donation_limits).toEqual({
			currency: 'EUR',
			min_minor: 500,
			max_minor: 200_050
		});
	});

	it('a fee of 0 is allowed: the fee is not taken then (seed, 1.12)', () => {
		const r = paymentSettingsFormSchema.safeParse({ ...valid, feeAmount: '0' });
		expect(r.success && r.data.membership_fee.amount_minor).toBe(0);
		if (!r.success) return;
		expect(parseMembershipFee(r.data.membership_fee)).toBeNull();
		expect(parsePeriodMonths(r.data.membership_fee)).toBe(12);
	});

	it.each(['', '-1', 'abc', '1.5', '1e3', '1234567890'])('fee amount %j is refused', (amount) => {
		expect(errorsOf({ ...valid, feeAmount: amount }).feeAmount).toBe('settings.error.amount');
	});

	it('an unknown currency is refused at its field', () => {
		const errors = errorsOf({ ...valid, feeCurrency: 'GBP', donationCurrency: '' });
		expect(errors.feeCurrency).toBe('settings.error.currency');
		expect(errors.donationCurrency).toBe('settings.error.currency');
	});

	it.each(['0', '121', '1.5', ''])('term of %j months is refused', (months) => {
		expect(errorsOf({ ...valid, feePeriodMonths: months }).feePeriodMonths).toBe(
			'settings.error.months'
		);
	});

	it('terms of 1 and 120 months are accepted', () => {
		expect(errorsOf({ ...valid, feePeriodMonths: '1' })).toEqual({});
		expect(errorsOf({ ...valid, feePeriodMonths: '120' })).toEqual({});
	});

	it('the donation minimum is at least one unit; above the maximum is refused', () => {
		expect(errorsOf({ ...valid, donationMin: '0' }).donationMin).toBe('settings.error.amount');
		expect(errorsOf({ ...valid, donationMax: '' }).donationMax).toBe('settings.error.amount');
		expect(errorsOf({ ...valid, donationMin: '5000', donationMax: '4999' }).donationMax).toBe(
			'settings.error.limits'
		);
		expect(errorsOf({ ...valid, donationMin: '5000', donationMax: '5000' })).toEqual({});
	});

	it.each(['4', '1441', '30.5', ''])('wait of %j minutes is refused', (minutes) => {
		expect(errorsOf({ ...valid, waitMinutes: minutes }).waitMinutes).toBe('settings.error.minutes');
	});

	it('waits of 5 and 1440 minutes are accepted', () => {
		expect(errorsOf({ ...valid, waitMinutes: '5' })).toEqual({});
		expect(errorsOf({ ...valid, waitMinutes: '1440' })).toEqual({});
	});

	it('stored values go back to the form in main units; a missing key leaves fields empty', () => {
		expect(
			paymentSettingsToForm({
				membership_fee: { amount_minor: 4999, currency: 'USD', period_months: 6 },
				donation_limits: { currency: 'AMD', min_minor: 1000, max_minor: 1_000_000 },
				payment_wait_minutes: 45
			})
		).toEqual({
			feeAmount: '49.99',
			feeCurrency: 'USD',
			feePeriodMonths: '6',
			donationCurrency: 'AMD',
			donationMin: '1000',
			donationMax: '1000000',
			waitMinutes: '45'
		});
		expect(paymentSettingsToForm({})).toEqual({});
	});

	it('a broken stored value does not pass the stored schema (the form shows it empty)', () => {
		const { membership_fee, donation_limits, payment_wait_minutes } = storedPaymentSettings.shape;
		expect(membership_fee.safeParse({ amount_minor: 0, currency: 'AMD', period_months: 12 }).success).toBe(true);
		expect(membership_fee.safeParse({ amount_minor: -1, currency: 'AMD', period_months: 12 }).success).toBe(false);
		expect(membership_fee.safeParse({ amount_minor: 100, currency: 'GBP', period_months: 12 }).success).toBe(false);
		expect(donation_limits.safeParse({ currency: 'AMD', min_minor: 10, max_minor: 5 }).success).toBe(false);
		expect(payment_wait_minutes.safeParse('30').success).toBe(false);
	});
});
