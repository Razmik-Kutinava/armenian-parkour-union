import { describe, expect, it } from 'vitest';
import { parseVolunteerSettings, VOLUNTEER_DEFAULTS } from './settings';

/* docs/03 section 19 (settings table): `site_settings.volunteer.cashier_invite_hours`, 72 by default;
 * the key is not seeded yet — a missing or broken value falls back to the default. */

describe('volunteer settings', () => {
	it('a missing key or a broken value — 72 hours for a cashier invite link', () => {
		expect(VOLUNTEER_DEFAULTS.cashierInviteHours).toBe(72);
		for (const value of [undefined, null, 'x', [], {}, { cashier_invite_hours: 0 }]) {
			expect(parseVolunteerSettings(value)).toEqual(VOLUNTEER_DEFAULTS);
		}
		for (const hours of [1.5, -3, '24', 721]) {
			expect(parseVolunteerSettings({ cashier_invite_hours: hours }).cashierInviteHours).toBe(72);
		}
	});

	it('a stored whole number of hours from 1 to 720 is used', () => {
		expect(parseVolunteerSettings({ cashier_invite_hours: 5, decline_threshold: 3 })).toEqual({
			cashierInviteHours: 5
		});
		expect(parseVolunteerSettings({ cashier_invite_hours: 720 }).cashierInviteHours).toBe(720);
	});
});
