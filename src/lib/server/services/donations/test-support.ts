import type { LimitDb } from '../../auth/rate-limit';
import { donationPurposes } from '../../db/schema/payments';
import type { Mail } from '../../mail/resend';
import { applyProviderStatus } from '../payments/apply';
import type { MockProvider } from '../payments/providers/mock';
import type { OnlineProvider } from '../payments/providers/types';
import { SITE, paymentRow } from '../payments/test-support';
import { donationEffects } from './effects';
import type { DonationLimits } from './settings';
import type { DonationInput, DonationStartDeps } from './start';

/* Test support only: donation tests run inside a rolled-back transaction; settings are passed in. */

export const LIMITS: DonationLimits = { currency: 'AMD', minMinor: 1000, maxMinor: 1_000_000 };

export const donationDeps = (
	provider: OnlineProvider | null,
	extra: Partial<DonationStartDeps> = {}
): DonationStartDeps => ({ provider, siteUrl: SITE, limits: LIMITS, waitMinutes: 30, ...extra });

export const guestInput = (extra: Partial<DonationInput> = {}): DonationInput => ({
	userId: null,
	amount: '5000',
	purposeId: null,
	donorName: 'Anna Guest',
	donorEmail: 'anna.guest@example.com',
	isAnonymous: false,
	locale: 'en',
	...extra
});

export async function addPurpose(
	tx: LimitDb,
	values: Partial<typeof donationPurposes.$inferInsert> = {}
) {
	const [row] = await tx
		.insert(donationPurposes)
		.values({ title: { en: 'Parkour park', ru: 'Паркур-парк' }, ...values })
		.returning();
	return row;
}

export const donationEffectsWith = (send: (mail: Mail) => Promise<void>) => ({
	donation: donationEffects({ send, siteUrl: SITE })
});

/** The "bank" settles the payment, then the provider path applies it (as a webhook would). */
export async function settleDonation(
	tx: LimitDb,
	provider: MockProvider,
	paymentId: string,
	status: 'paid' | 'failed' | 'cancelled' | 'refunded',
	effects: ReturnType<typeof donationEffectsWith>
) {
	const { providerPaymentId } = await paymentRow(tx, paymentId);
	provider.simulate(providerPaymentId!, status);
	const state = await provider.getStatus(providerPaymentId!);
	return applyProviderStatus(
		tx,
		{ provider: provider.id, providerPaymentId: providerPaymentId!, ...state },
		effects
	);
}
