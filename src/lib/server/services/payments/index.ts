import { PUBLIC_SITE_URL } from '$app/env/private';
import { consume, limits, type LimitDb } from '../../auth/rate-limit';
import { releaseHoldsNow } from '../registrations';
import { startOnlinePayment, type NewOnlinePayment, type StartResult } from './create';
import { onlineProvider, providerById } from './providers';
import { reconcilePayments, type ReconcileSummary } from './reconcile';
import { paymentForReturn, type ReturnView } from './return';
import { singleFlight, startTimer } from './schedule';

export { applyProviderStatus, type ApplyResult, type ProviderReport } from './apply';
export type { NewOnlinePayment, StartResult } from './create';
export { paymentEffects, type PaymentEffect, type PaymentEffects } from './effects';
export type { ReconcileSummary } from './reconcile';
export type { ReturnView } from './return';
export { receiveWebhook } from './webhook';

/** A new online payment: provider by `PAYMENT_PROVIDER` + `feature_flags`, addresses by `PUBLIC_SITE_URL`. */
export async function startPayment(db: LimitDb, input: NewOnlinePayment): Promise<StartResult> {
	return startOnlinePayment(db, input, {
		provider: await onlineProvider(db),
		siteUrl: PUBLIC_SITE_URL
	});
}

/** docs/07 section 7 p. 1: `/payment/success|cancel`; provider checks are limited per IP. */
export function checkPaymentReturn(
	db: LimitDb,
	pid: string,
	ip: string
): Promise<ReturnView | null> {
	return paymentForReturn(db, pid, {
		providerOf: providerById,
		allowCheck: () => consume(db, `payment-return:ip:${ip}`, limits.paymentReturnPerIp)
	});
}

type ReconcileRun = ReconcileSummary & { released: number };
let reconcileOnce: (() => Promise<ReconcileRun>) | null = null;

/**
 * docs/07 section 7: one reconciliation run; the timer and `/api/cron/payments` share it. Expired
 * event payments are cancelled first, then their seats are released (docs/07 section 5.3 p. 4).
 */
export function reconcileNow(db: LimitDb): Promise<ReconcileRun> {
	reconcileOnce ??= singleFlight(async () => {
		const summary = {
			...(await reconcilePayments(db, { providerOf: providerById })),
			released: await releaseHoldsNow(db)
		};
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
