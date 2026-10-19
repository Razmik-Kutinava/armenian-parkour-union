import { PUBLIC_SITE_URL } from '$app/env/private';
import type { LimitDb } from '../../auth/rate-limit';
import { startOnlinePayment, type NewOnlinePayment, type StartResult } from './create';
import { onlineProvider, providerById } from './providers';
import { reconcilePayments, type ReconcileSummary } from './reconcile';
import { singleFlight, startTimer } from './schedule';

export { applyProviderStatus, type ApplyResult, type ProviderReport } from './apply';
export type { NewOnlinePayment, StartResult } from './create';
export { paymentEffects, type PaymentEffect, type PaymentEffects } from './effects';
export type { ReconcileSummary } from './reconcile';
export { receiveWebhook } from './webhook';

/** A new online payment: provider by `PAYMENT_PROVIDER` + `feature_flags`, addresses by `PUBLIC_SITE_URL`. */
export async function startPayment(db: LimitDb, input: NewOnlinePayment): Promise<StartResult> {
	return startOnlinePayment(db, input, {
		provider: await onlineProvider(db),
		siteUrl: PUBLIC_SITE_URL
	});
}

let reconcileOnce: (() => Promise<ReconcileSummary>) | null = null;

/** docs/07 section 7: one reconciliation run; the timer and `/api/cron/payments` share it. */
export function reconcileNow(db: LimitDb): Promise<ReconcileSummary> {
	reconcileOnce ??= singleFlight(async () => {
		const summary = await reconcilePayments(db, { providerOf: providerById });
		if (Object.values(summary).some(Boolean)) console.info('reconcile:', JSON.stringify(summary));
		return summary;
	});
	return reconcileOnce();
}

let stopTimer: (() => void) | null = null;

/** Every 5 minutes while the machine is up; the hourly external call covers the time it sleeps. */
export function startReconcileTimer(db: LimitDb) {
	stopTimer ??= startTimer(() => reconcileNow(db), {
		firstDelayMs: 30_000,
		intervalMs: 5 * 60_000
	});
}
