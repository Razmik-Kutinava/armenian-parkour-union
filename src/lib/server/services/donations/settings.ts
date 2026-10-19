import { inArray } from 'drizzle-orm';
import { CURRENCIES, type Currency } from '#lib/money.ts';
import type { LimitDb } from '../../auth/rate-limit';
import { siteSettings } from '../../db/schema/service';

export type DonationLimits = { currency: Currency; minMinor: number; maxMinor: number };

const INT_MAX = 2_147_483_647;

const fields = (value: unknown): Record<string, unknown> =>
	value && typeof value === 'object' && !Array.isArray(value)
		? (value as Record<string, unknown>)
		: {};

const isAmount = (value: unknown): value is number =>
	typeof value === 'number' && Number.isInteger(value) && value >= 1 && value <= INT_MAX;

/** `site_settings.donation_limits` (decisions.md 2026-10-19, 3.7); `null` — broken: no donations. */
export function parseDonationLimits(value: unknown): DonationLimits | null {
	const { currency, min_minor: min, max_minor: max } = fields(value);
	if (!isAmount(min) || !isAmount(max) || min > max) return null;
	if (!CURRENCIES.includes(currency as Currency)) return null;
	return { currency: currency as Currency, minMinor: min, maxMinor: max };
}

/** docs/06 section 4.8: the public list is optional, on only by an explicit flag. */
export function parsePublicListFlag(flags: unknown): boolean {
	return fields(flags).donations_public_list === true;
}

async function settings(db: LimitDb) {
	const rows = await db
		.select()
		.from(siteSettings)
		.where(inArray(siteSettings.key, ['donation_limits', 'feature_flags']));
	return (key: string) => rows.find((r) => r.key === key)?.value;
}

export type DonationSettings = { limits: DonationLimits | null; publicList: boolean };

export async function donationSettings(db: LimitDb): Promise<DonationSettings> {
	const value = await settings(db);
	return {
		limits: parseDonationLimits(value('donation_limits')),
		publicList: parsePublicListFlag(value('feature_flags'))
	};
}
