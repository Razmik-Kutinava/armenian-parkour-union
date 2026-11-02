import { describe, expect, it } from 'vitest';
import { parseVolunteerSettings, VOLUNTEER_DEFAULTS } from './settings';

/* docs/03 section 19: `cashier_invite_hours` (72) and `decline_threshold` (3); missing or broken
 * fields fall back to the defaults. */

describe('volunteer settings', () => {
	it('a missing key or a broken value — 72 hours and threshold 3', () => {
		expect(VOLUNTEER_DEFAULTS).toEqual({ cashierInviteHours: 72, declineThreshold: 3 });
		for (const value of [undefined, null, 'x', [], {}]) {
			expect(parseVolunteerSettings(value)).toEqual(VOLUNTEER_DEFAULTS);
		}
		for (const hours of [1.5, -3, '24', 721]) {
			expect(parseVolunteerSettings({ cashier_invite_hours: hours }).cashierInviteHours).toBe(
				72
			);
		}
		for (const n of [0, 21, 1.5, '3']) {
			expect(parseVolunteerSettings({ decline_threshold: n }).declineThreshold).toBe(3);
		}
	});

	it('stored whole numbers in range are used', () => {
		expect(parseVolunteerSettings({ cashier_invite_hours: 5, decline_threshold: 3 })).toEqual({
			cashierInviteHours: 5,
			declineThreshold: 3
		});
		expect(parseVolunteerSettings({ cashier_invite_hours: 720 }).cashierInviteHours).toBe(720);
		expect(parseVolunteerSettings({ decline_threshold: 1 }).declineThreshold).toBe(1);
		expect(parseVolunteerSettings({ decline_threshold: 20 }).declineThreshold).toBe(20);
	});
});
