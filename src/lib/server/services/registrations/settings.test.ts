import { describe, expect, it } from 'vitest';
import { REGISTRATION_DEFAULTS, parseRegistrationSettings } from './settings';

/* docs/03 section 16: hold 30 minutes, 48 hours to pay after the waitlist; cancel until the start. */

describe('registrations: settings', () => {
	it('defaults: 30 minutes, 48 hours, cancel until the start', () => {
		expect(REGISTRATION_DEFAULTS).toEqual({ holdMinutes: 30, offerHours: 48, cancelHours: 0 });
	});

	it('reads the stored snake_case value', () => {
		expect(
			parseRegistrationSettings({ hold_minutes: 20, offer_hours: 24, cancel_hours: 12 })
		).toEqual({ holdMinutes: 20, offerHours: 24, cancelHours: 12 });
	});

	it('missing or broken — the defaults, so registration always works', () => {
		for (const value of [
			undefined,
			null,
			'30',
			[],
			{},
			{ hold_minutes: 0, offer_hours: 48, cancel_hours: 0 },
			{ hold_minutes: 30, offer_hours: 0, cancel_hours: 0 },
			{ hold_minutes: 30, offer_hours: 48, cancel_hours: -1 },
			{ hold_minutes: 1.5, offer_hours: 48, cancel_hours: 0 },
			{ hold_minutes: 30, offer_hours: 48, cancel_hours: 24 * 31 },
			{ hold_minutes: 25 * 60, offer_hours: 48, cancel_hours: 0 }
		]) {
			expect(parseRegistrationSettings(value), JSON.stringify(value)).toEqual(
				REGISTRATION_DEFAULTS
			);
		}
	});
});
