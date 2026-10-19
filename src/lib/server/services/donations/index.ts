import { PUBLIC_SITE_URL } from '$app/env/private';
import type { LimitDb } from '../../auth/rate-limit';
import { onlineProvider } from '../payments/providers';
import { paymentWaitMinutes } from '../payments/settings';
import { donationSettings } from './settings';
import { startDonationPayment, type DonationInput, type DonationStart } from './start';

export type { DonationStart, DonationInput } from './start';
export type { DonationLimits } from './settings';

/** "Donate": provider by `PAYMENT_PROVIDER` + `feature_flags`, addresses by `PUBLIC_SITE_URL`. */
export async function startDonation(
	db: LimitDb,
	input: DonationInput,
	ip: string
): Promise<DonationStart> {
	return startDonationPayment(db, input, {
		provider: await onlineProvider(db),
		siteUrl: PUBLIC_SITE_URL,
		limits: (await donationSettings(db)).limits,
		waitMinutes: await paymentWaitMinutes(db),
		ip
	});
}
