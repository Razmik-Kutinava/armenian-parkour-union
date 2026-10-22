import { eq } from 'drizzle-orm';
import type { LimitDb } from '../../auth/rate-limit';
import { siteSettings } from '../../db/schema/service';

/* docs/03 section 16: `site_settings.event_registration`; the defaults are the documented ones and
 * "cancel until the start" (questions.md, 5.3). */

export type RegistrationSettings = {
	/** How long an unpaid registration holds its seat. */
	holdMinutes: number;
	/** How long the first in line has to pay after a seat frees up. */
	offerHours: number;
	/** The member may cancel until this many hours before the start. */
	cancelHours: number;
};

export const REGISTRATION_DEFAULTS: RegistrationSettings = {
	holdMinutes: 30,
	offerHours: 48,
	cancelHours: 0
};

const isWhole = (v: unknown, min: number, max: number): v is number =>
	typeof v === 'number' && Number.isInteger(v) && v >= min && v <= max;

/** The stored snake_case value; missing or broken — the defaults, so registration always works. */
export function parseRegistrationSettings(value: unknown): RegistrationSettings {
	if (!value || typeof value !== 'object' || Array.isArray(value)) return REGISTRATION_DEFAULTS;
	const v = value as Record<string, unknown>;
	const ok =
		isWhole(v.hold_minutes, 1, 24 * 60) &&
		isWhole(v.offer_hours, 1, 30 * 24) &&
		isWhole(v.cancel_hours, 0, 30 * 24);
	if (!ok) return REGISTRATION_DEFAULTS;
	return {
		holdMinutes: v.hold_minutes as number,
		offerHours: v.offer_hours as number,
		cancelHours: v.cancel_hours as number
	};
}

export async function registrationSettings(db: LimitDb): Promise<RegistrationSettings> {
	const [row] = await db
		.select({ value: siteSettings.value })
		.from(siteSettings)
		.where(eq(siteSettings.key, 'event_registration'));
	return parseRegistrationSettings(row?.value);
}
