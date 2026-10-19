import { eq } from 'drizzle-orm';
import type { Locale } from '#lib/i18n/locales.ts';
import { translate } from '#lib/i18n/translate.ts';
import { priceToMinor } from '#lib/money.ts';
import {
	consume,
	limits as securityLimits,
	type LimitDb,
	type LimitRule
} from '../../auth/rate-limit';
import { users } from '../../db/schema/users';
import { startOnlinePayment, type StartDeps } from '../payments/create';
import { isUuid } from '../users/target';
import type { DonationLimits } from './settings';

/** A checked form (validation/donation.ts); a member's name and email are taken from the account. */
export type DonationInput = {
	userId: string | null;
	amount: string;
	purposeId: string | null;
	donorName: string | null;
	donorEmail: string | null;
	isAnonymous: boolean;
	locale: Locale;
};

/** Settings read by the caller (`null` — broken); `ip` — counted against `limit`. */
export type DonationStartDeps = StartDeps & {
	limits: DonationLimits | null;
	waitMinutes: number | null;
	ip?: string;
	limit?: LimitRule;
};

export type DonationStart =
	| { ok: true; paymentId: string; checkoutUrl: string }
	| { ok: false; reason: 'amount' | 'unavailable' | 'invalid' | 'limited' | 'provider_error' };

/** docs/07 section 5.2 p. 2: the user types the amount, so the range is checked here. */
export function donationAmount(raw: string, limits: DonationLimits): number | null {
	const amount = priceToMinor(raw.replace(/\s/g, ''), limits.currency);
	return amount !== null && amount >= limits.minMinor && amount <= limits.maxMinor ? amount : null;
}

type Payer = { userId: string | null; name: string; email: string } | 'unavailable' | 'invalid';

/** docs/07 section 5.2 p. 4: a member by the account, a guest by the name and email given. */
async function payer(db: LimitDb, input: DonationInput): Promise<Payer> {
	if (input.userId === null) {
		const name = input.donorName?.trim();
		const email = input.donorEmail?.trim();
		return name && email ? { userId: null, name, email } : 'invalid';
	}
	if (!isUuid(input.userId)) return 'unavailable';
	const [user] = await db
		.select({
			email: users.email,
			name: users.name,
			status: users.status,
			deletedAt: users.deletedAt
		})
		.from(users)
		.where(eq(users.id, input.userId));
	if (!user || user.deletedAt || user.status !== 'active') return 'unavailable';
	return { userId: input.userId, name: user.name, email: user.email };
}

/**
 * docs/07 sections 3, 5.2: a one-off donation by anyone. The amount is checked against
 * `donation_limits`, the currency comes from them too; every donation is a new payment.
 */
export async function startDonationPayment(
	db: LimitDb,
	input: DonationInput,
	deps: DonationStartDeps
): Promise<DonationStart> {
	const { limits, waitMinutes, provider } = deps;
	if (!limits) return { ok: false, reason: 'unavailable' };
	const amountMinor = donationAmount(input.amount, limits);
	if (amountMinor === null) return { ok: false, reason: 'amount' };
	if (!waitMinutes || !provider) return { ok: false, reason: 'unavailable' };
	const from = await payer(db, input);
	if (typeof from === 'string') return { ok: false, reason: from };
	if (input.purposeId !== null && !isUuid(input.purposeId)) return { ok: false, reason: 'invalid' };
	if (deps.ip) {
		const key = `donate:ip:${deps.ip}`;
		if (!(await consume(db, key, deps.limit ?? securityLimits.donatePerIp))) {
			return { ok: false, reason: 'limited' };
		}
	}
	const guest = from.userId === null;
	const result = await startOnlinePayment(
		db,
		{
			kind: 'donation',
			userId: from.userId,
			amountMinor,
			currency: limits.currency,
			description: translate(input.locale, 'donate.payment.description'),
			locale: input.locale,
			payerEmail: from.email,
			holdMinutes: waitMinutes,
			donation: {
				purposeId: input.purposeId,
				donorName: guest ? from.name : null,
				donorEmail: guest ? from.email : null,
				isAnonymous: input.isAnonymous
			}
		},
		deps
	);
	if (result.ok) return { ok: true, paymentId: result.paymentId, checkoutUrl: result.checkoutUrl };
	if (result.reason === 'online_off') return { ok: false, reason: 'unavailable' };
	return { ok: false, reason: result.reason };
}
