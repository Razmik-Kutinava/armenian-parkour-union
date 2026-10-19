import { eq } from 'drizzle-orm';
import { CURRENCIES, type Currency } from '#lib/money.ts';
import type { LimitDb } from '../../auth/rate-limit';
import { siteSettings } from '../../db/schema/service';

export type MembershipFee = { amountMinor: number; currency: Currency; periodMonths: number };

const INT_MAX = 2_147_483_647;

const isInt = (value: unknown, min: number, max: number): value is number =>
	typeof value === 'number' && Number.isInteger(value) && value >= min && value <= max;

const fields = (value: unknown): Record<string, unknown> =>
	value && typeof value === 'object' ? (value as Record<string, unknown>) : {};

/** Term of one paid period, `null` when broken (docs/03 section 2 p. 1). */
export function parsePeriodMonths(value: unknown): number | null {
	const months = fields(value).period_months;
	return isInt(months, 1, 120) ? months : null;
}

/** `null` — amount not set (0) or broken: no payment then. */
export function parseMembershipFee(value: unknown): MembershipFee | null {
	const { amount_minor: amount, currency } = fields(value);
	const periodMonths = parsePeriodMonths(value);
	if (!isInt(amount, 1, INT_MAX) || periodMonths === null) return null;
	if (!CURRENCIES.includes(currency as Currency)) return null;
	return { amountMinor: amount, currency: currency as Currency, periodMonths };
}

async function feeValue(db: LimitDb): Promise<unknown> {
	const [row] = await db
		.select({ value: siteSettings.value })
		.from(siteSettings)
		.where(eq(siteSettings.key, 'membership_fee'));
	return row?.value;
}

export const membershipFee = async (db: LimitDb) => parseMembershipFee(await feeValue(db));

export const membershipPeriodMonths = async (db: LimitDb) => parsePeriodMonths(await feeValue(db));
