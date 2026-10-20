import { z } from 'zod';
import type { MessageKey } from '#lib/i18n/translate.ts';
import { CURRENCIES, minorToInput, priceToMinor, type Currency } from '#lib/money.ts';

/* Admin "Membership and payments" (docs/05 section 21; keys — decisions.md 2026-10-19, 3.6 and 3.7).
 * Messages are i18n keys. */

const INT_MAX = 2_147_483_647;
const MAX_WAIT = 24 * 60;
const int = (min: number, max: number) => z.number().int().min(min).max(max);
const currency = z.enum(CURRENCIES);

/** Stored shape: what `parseMembershipFee`, `parseDonationLimits` and `parseWaitMinutes` read. */
export const storedPaymentSettings = z.object({
	membership_fee: z.object({
		amount_minor: int(0, INT_MAX),
		currency,
		period_months: int(1, 120)
	}),
	donation_limits: z
		.object({ currency, min_minor: int(1, INT_MAX), max_minor: int(1, INT_MAX) })
		.refine((v) => v.min_minor <= v.max_minor),
	payment_wait_minutes: int(1, MAX_WAIT)
});
export type PaymentSettingsValues = z.output<typeof storedPaymentSettings>;
export const paymentSettingKeys = Object.keys(
	storedPaymentSettings.shape
) as (keyof PaymentSettingsValues)[];

export const PAYMENT_SETTINGS_FIELDS = [
	'feeAmount',
	'feeCurrency',
	'feePeriodMonths',
	'donationCurrency',
	'donationMin',
	'donationMax',
	'waitMinutes'
] as const;

const field = z.string().trim().optional();
const isCurrency = (v: unknown): v is Currency => CURRENCIES.includes(v as Currency);

/* One transform checks every field, so all errors show at once (amounts depend on the currency). */
export const paymentSettingsFormSchema = z
	.object(
		Object.fromEntries(PAYMENT_SETTINGS_FIELDS.map((f) => [f, field])) as Record<
			(typeof PAYMENT_SETTINGS_FIELDS)[number],
			typeof field
		>
	)
	.transform((f, ctx): PaymentSettingsValues => {
		const issue = (path: string, message: MessageKey) =>
			ctx.addIssue({ code: 'custom', path: [path], message });
		const currencyOf = (path: string, raw?: string): Currency => {
			if (isCurrency(raw)) return raw;
			issue(path, 'settings.error.currency');
			return 'AMD';
		};
		const whole = (
			path: string,
			raw: string | undefined,
			max: number,
			min: number,
			m: MessageKey
		) => {
			const n = /^\d{1,4}$/.test(raw ?? '') ? Number(raw) : NaN;
			if (n >= min && n <= max) return n;
			issue(path, m);
			return min;
		};
		const amount = (path: string, raw: string | undefined, cur: Currency, min: number) => {
			const value = priceToMinor(raw ?? '', cur);
			if (value !== null && value >= min) return value;
			issue(path, 'settings.error.amount');
			return null;
		};

		const feeCurrency = currencyOf('feeCurrency', f.feeCurrency);
		const donationCurrency = currencyOf('donationCurrency', f.donationCurrency);
		const fee = amount('feeAmount', f.feeAmount, feeCurrency, 0);
		const min = amount('donationMin', f.donationMin, donationCurrency, 1);
		const max = amount('donationMax', f.donationMax, donationCurrency, 1);
		if (min !== null && max !== null && min > max) issue('donationMax', 'settings.error.limits');
		return {
			membership_fee: {
				amount_minor: fee ?? 0,
				currency: feeCurrency,
				period_months: whole('feePeriodMonths', f.feePeriodMonths, 120, 1, 'settings.error.months')
			},
			donation_limits: { currency: donationCurrency, min_minor: min ?? 1, max_minor: max ?? 1 },
			payment_wait_minutes: whole(
				'waitMinutes',
				f.waitMinutes,
				MAX_WAIT,
				5,
				'settings.error.minutes'
			)
		};
	});

/** Stored values back to the form, amounts in main units; a missing key leaves its fields out. */
export function paymentSettingsToForm(
	values: Partial<PaymentSettingsValues>
): Record<string, string> {
	const form: Record<string, string> = {};
	const fee = values.membership_fee;
	if (fee) {
		form.feeAmount = minorToInput(fee.amount_minor, fee.currency);
		form.feeCurrency = fee.currency;
		form.feePeriodMonths = String(fee.period_months);
	}
	const limits = values.donation_limits;
	if (limits) {
		form.donationCurrency = limits.currency;
		form.donationMin = minorToInput(limits.min_minor, limits.currency);
		form.donationMax = minorToInput(limits.max_minor, limits.currency);
	}
	if (values.payment_wait_minutes !== undefined) {
		form.waitMinutes = String(values.payment_wait_minutes);
	}
	return form;
}
