import type { LimitDb } from '../auth/rate-limit';
import { siteSettings } from '../db/schema/service';

/*
 * docs/02 section 10 keys plus site_name (decisions.md, 1.10b). Empty blocks stay hidden on the
 * site until the owner fills them in the admin panel. The fee amount is "to be set" (docs/03
 * section 16): 0 until the owner sets it before stage 3.
 */
export const SEED_SETTINGS = {
	site_name: { en: 'Armenian Parkour Union' },
	contacts: {},
	socials: {},
	footer: {},
	requisites: {},
	feature_flags: {},
	/** docs/03 section 11: active hero blocks at most (decisions.md 2026-10-08, 2.6). */
	hero_max_active: 5,
	membership_fee: { amount_minor: 0, currency: 'AMD', period_months: 12 },
	/** How long a fee or donation payment waits at the provider (decisions.md 2026-10-19, 3.6). */
	payment_wait_minutes: 30
};

/** Adds missing keys only: values changed in the admin panel are never overwritten. */
export async function seedSettings(db: LimitDb): Promise<string[]> {
	const rows = await db
		.insert(siteSettings)
		.values(Object.entries(SEED_SETTINGS).map(([key, value]) => ({ key, value })))
		.onConflictDoNothing({ target: siteSettings.key })
		.returning({ key: siteSettings.key });
	return rows.map((r) => r.key);
}
