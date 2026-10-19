import { and, eq } from 'drizzle-orm';
import type { LimitDb } from '../../auth/rate-limit';
import { donationPurposes, memberships } from '../../db/schema/payments';
import { isUuid } from '../users/target';
import type { NewOnlinePayment } from './create';
import { PaymentConfigError, type OnlineProvider } from './providers/types';

const INT_MAX = 2_147_483_647;

/** docs/07 section 14 p. 7: return addresses come from `PUBLIC_SITE_URL` only. */
export function siteBase(siteUrl: string | undefined): URL {
	const url = siteUrl && URL.canParse(siteUrl) ? new URL(siteUrl) : null;
	if (!url || (url.protocol !== 'https:' && url.protocol !== 'http:')) {
		throw new PaymentConfigError('PUBLIC_SITE_URL is not a site address');
	}
	return url;
}

export function returnUrl(base: URL, path: string, paymentId: string): string {
	const url = new URL(path, base);
	url.searchParams.set('pid', paymentId);
	return url.href;
}

/** The fields alone: amount, currency, payer, which links fit the kind. */
export function validShape(input: NewOnlinePayment, provider: OnlineProvider): boolean {
	const { amountMinor, holdMinutes, userId, kind } = input;
	if (!Number.isSafeInteger(amountMinor) || amountMinor <= 0 || amountMinor > INT_MAX) return false;
	if (!Number.isSafeInteger(holdMinutes) || holdMinutes <= 0) return false;
	if (!provider.currencies.includes(input.currency) || !input.description.trim()) return false;
	if (userId === null ? kind !== 'donation' : !isUuid(userId)) return false;
	if (input.membershipId && kind !== 'membership') return false;
	return !input.donation || kind === 'donation';
}

/** A membership only of the same user and still pending; a donation purpose only active. */
export async function validLinks(tx: LimitDb, input: NewOnlinePayment): Promise<boolean> {
	const { membershipId, userId } = input;
	if (membershipId) {
		if (!userId || !isUuid(membershipId)) return false;
		const [membership] = await tx
			.select({ id: memberships.id })
			.from(memberships)
			.where(
				and(
					eq(memberships.id, membershipId),
					eq(memberships.userId, userId),
					eq(memberships.status, 'pending')
				)
			);
		if (!membership) return false;
	}
	const purposeId = input.donation?.purposeId;
	if (purposeId) {
		if (!isUuid(purposeId)) return false;
		const [purpose] = await tx
			.select({ id: donationPurposes.id })
			.from(donationPurposes)
			.where(and(eq(donationPurposes.id, purposeId), eq(donationPurposes.isActive, true)));
		if (!purpose) return false;
	}
	return true;
}
