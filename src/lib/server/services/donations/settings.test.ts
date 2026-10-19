import { describe, expect, it } from 'vitest';
import { parseDonationLimits, parsePublicListFlag } from './settings';

/* docs/07 sections 5.2, 13; decisions.md 2026-10-19 (3.7): limits from `donation_limits`, the public
 * list only behind an explicit flag. */

describe('donations: settings', () => {
	it('limits: integer minor units, a known currency, min not above max', () => {
		expect(parseDonationLimits({ currency: 'AMD', min_minor: 1000, max_minor: 1_000_000 })).toEqual(
			{
				currency: 'AMD',
				minMinor: 1000,
				maxMinor: 1_000_000
			}
		);
		expect(parseDonationLimits({ currency: 'AMD', min_minor: 500, max_minor: 500 })).toEqual({
			currency: 'AMD',
			minMinor: 500,
			maxMinor: 500
		});
	});

	it('broken limits: null, so no donation can start', () => {
		for (const value of [
			undefined,
			null,
			{},
			'1000',
			{ currency: 'AMD', min_minor: 0, max_minor: 1000 },
			{ currency: 'AMD', min_minor: 2000, max_minor: 1000 },
			{ currency: 'AMD', min_minor: 10.5, max_minor: 1000 },
			{ currency: 'AMD', min_minor: 1000, max_minor: 3_000_000_000 },
			{ currency: 'GBP', min_minor: 1000, max_minor: 2000 },
			{ currency: 'AMD', min_minor: '1000', max_minor: 2000 }
		]) {
			expect(parseDonationLimits(value), JSON.stringify(value)).toBeNull();
		}
	});

	it('public list: on only when feature_flags.donations_public_list is exactly true', () => {
		expect(parsePublicListFlag({ donations_public_list: true })).toBe(true);
		for (const value of [
			undefined,
			null,
			{},
			{ donations_public_list: 'true' },
			{ donations_public_list: 1 },
			{ donations_public_list: false },
			[true]
		]) {
			expect(parsePublicListFlag(value), JSON.stringify(value)).toBe(false);
		}
	});
});
