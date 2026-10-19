import { PUBLIC_SITE_URL } from '$app/env/private';
import type { LimitDb } from '../../auth/rate-limit';
import { startOnlinePayment, type NewOnlinePayment, type StartResult } from './create';
import { onlineProvider } from './providers';

export { applyProviderStatus, type ApplyResult, type ProviderReport } from './apply';
export type { NewOnlinePayment, StartResult } from './create';
export { paymentEffects, type PaymentEffect, type PaymentEffects } from './effects';

/** A new online payment: provider by `PAYMENT_PROVIDER` + `feature_flags`, addresses by `PUBLIC_SITE_URL`. */
export async function startPayment(db: LimitDb, input: NewOnlinePayment): Promise<StartResult> {
	return startOnlinePayment(db, input, {
		provider: await onlineProvider(db),
		siteUrl: PUBLIC_SITE_URL
	});
}
