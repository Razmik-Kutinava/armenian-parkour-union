import { describe, expect, it } from 'vitest';
import { parseWaitMinutes } from '../payments/settings';
import { parseMembershipFee, parsePeriodMonths } from './fee';

/* docs/03 section 2 p. 1, docs/07 section 5.1 p. 2: fee, currency and term from `membership_fee`;
 * the amount 0 means "not set yet" — no payment (PROGRESS 1.12). */

const FEE = { amount_minor: 20_000, currency: 'AMD', period_months: 12 };

describe('memberships: fee settings', () => {
	it('a valid fee in minimal units', () => {
		expect(parseMembershipFee(FEE)).toEqual({
			amountMinor: 20_000,
			currency: 'AMD',
			periodMonths: 12
		});
	});

	it('not set or broken: no fee', () => {
		const broken = [
			{ ...FEE, amount_minor: 0 },
			{ ...FEE, amount_minor: -5 },
			{ ...FEE, amount_minor: 10.5 },
			{ ...FEE, amount_minor: 2 ** 31 },
			{ ...FEE, amount_minor: '20000' },
			{ ...FEE, currency: 'RUB' },
			{ ...FEE, period_months: 0 },
			{ ...FEE, period_months: 121 },
			{ ...FEE, period_months: 'year' },
			{},
			null,
			'free'
		];
		for (const value of broken) expect(parseMembershipFee(value), JSON.stringify(value)).toBeNull();
	});

	it('the term alone is read even while the amount is not set', () => {
		expect(parsePeriodMonths({ ...FEE, amount_minor: 0 })).toBe(12);
		expect(parsePeriodMonths({ ...FEE, period_months: 'year' })).toBeNull();
	});

	it('payment wait: whole minutes from 1 to 24 hours', () => {
		expect(parseWaitMinutes(30)).toBe(30);
		expect(parseWaitMinutes(1440)).toBe(1440);
		for (const value of [0, -1, 30.5, 1441, '30', null, undefined]) {
			expect(parseWaitMinutes(value), String(value)).toBeNull();
		}
	});
});
