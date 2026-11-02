import { eq } from 'drizzle-orm';
import type { LimitDb } from '../../auth/rate-limit';
import { siteSettings } from '../../db/schema/service';

/* docs/02 `site_settings.volunteer`, docs/03 section 19: cashier invite hours and decline
 * threshold. The key is not seeded yet: a missing or broken field — its default. */

export type VolunteerSettings = { cashierInviteHours: number; declineThreshold: number };

export const VOLUNTEER_DEFAULTS: VolunteerSettings = {
	cashierInviteHours: 72,
	declineThreshold: 3
};

const isHours = (v: unknown): v is number =>
	typeof v === 'number' && Number.isInteger(v) && v >= 1 && v <= 720;
const isThreshold = (v: unknown): v is number =>
	typeof v === 'number' && Number.isInteger(v) && v >= 1 && v <= 20;

export function parseVolunteerSettings(value: unknown): VolunteerSettings {
	if (!value || typeof value !== 'object' || Array.isArray(value)) return VOLUNTEER_DEFAULTS;
	const raw = value as Record<string, unknown>;
	return {
		cashierInviteHours: isHours(raw.cashier_invite_hours)
			? raw.cashier_invite_hours
			: VOLUNTEER_DEFAULTS.cashierInviteHours,
		declineThreshold: isThreshold(raw.decline_threshold)
			? raw.decline_threshold
			: VOLUNTEER_DEFAULTS.declineThreshold
	};
}

export async function volunteerSettings(db: LimitDb): Promise<VolunteerSettings> {
	const [row] = await db
		.select({ value: siteSettings.value })
		.from(siteSettings)
		.where(eq(siteSettings.key, 'volunteer'));
	return parseVolunteerSettings(row?.value);
}

/** Test / seed helper: upsert the `volunteer` key (no audit — callers that need it use writeSettings). */
export async function writeVolunteerSettings(
	db: LimitDb,
	settings: VolunteerSettings
): Promise<void> {
	const value = {
		cashier_invite_hours: settings.cashierInviteHours,
		decline_threshold: settings.declineThreshold
	};
	await db
		.insert(siteSettings)
		.values({ key: 'volunteer', value })
		.onConflictDoUpdate({ target: siteSettings.key, set: { value } });
}
