import { PUBLIC_SITE_URL } from '$app/env/private';
import type { Locale } from '#lib/i18n/locales.ts';
import type { LimitDb } from '../../auth/rate-limit';
import { sendMail } from '../../mail';
import { onlineProvider } from '../payments/providers';
import { paymentWaitMinutes } from '../payments/settings';
import { runMembershipDaily, type DailySummary } from './daily';
import { membershipFee } from './fee';
import { startMembershipPayment, type MembershipStart } from './start';

export type { DailySummary } from './daily';
export { membershipFee, type MembershipFee } from './fee';
export type { MembershipStart } from './start';

/** "Pay the fee": provider by `PAYMENT_PROVIDER` + `feature_flags`, addresses by `PUBLIC_SITE_URL`. */
export async function startMembership(
	db: LimitDb,
	userId: string,
	locale: Locale
): Promise<MembershipStart> {
	return startMembershipPayment(db, userId, locale, {
		provider: await onlineProvider(db),
		siteUrl: PUBLIC_SITE_URL,
		fee: await membershipFee(db),
		waitMinutes: await paymentWaitMinutes(db)
	});
}

export async function membershipDailyNow(db: LimitDb): Promise<DailySummary> {
	const summary = await runMembershipDaily(db, { send: sendMail, siteUrl: PUBLIC_SITE_URL });
	console.info('memberships daily:', JSON.stringify(summary));
	return summary;
}
