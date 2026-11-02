import { eq } from 'drizzle-orm';
import type { LimitDb } from '../../auth/rate-limit';
import { siteSettings } from '../../db/schema/service';

/* docs/02 `site_settings.volunteer`, docs/03 section 19: hours a cashier invite link lives.
 * The key is not seeded yet: a missing or broken field — its default. */

export type VolunteerSettings = { cashierInviteHours: number };

export const VOLUNTEER_DEFAULTS: VolunteerSettings = { cashierInviteHours: 72 };

const isHours = (v: unknown): v is number =>
	typeof v === 'number' && Number.isInteger(v) && v >= 1 && v <= 720;

export function parseVolunteerSettings(value: unknown): VolunteerSettings {
	if (!value || typeof value !== 'object' || Array.isArray(value)) return VOLUNTEER_DEFAULTS;
	const hours = (value as Record<string, unknown>).cashier_invite_hours;
	return { cashierInviteHours: isHours(hours) ? hours : VOLUNTEER_DEFAULTS.cashierInviteHours };
}

export async function volunteerSettings(db: LimitDb): Promise<VolunteerSettings> {
	const [row] = await db
		.select({ value: siteSettings.value })
		.from(siteSettings)
		.where(eq(siteSettings.key, 'volunteer'));
	return parseVolunteerSettings(row?.value);
}
