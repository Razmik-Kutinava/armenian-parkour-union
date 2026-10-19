import { and, asc, eq, gte, isNotNull, lt, lte } from 'drizzle-orm';
import type { LimitDb } from '../../auth/rate-limit';
import { payments } from '../../db/schema/payments';
import { applyProviderStatus } from './apply';
import { paymentEffects, type PaymentEffects } from './effects';
import { expirePayment } from './expire';
import {
	PaymentProviderError,
	type OnlineProvider,
	type PaymentProvider,
	type ProviderPaymentState
} from './providers/types';
import { logStatusChange } from './status-log';

export type ReconcileDeps = {
	/** Provider of an existing payment; `null` — not available here, the payment is skipped. */
	providerOf: (id: string) => PaymentProvider | null;
	now?: Date;
	effects?: PaymentEffects;
	limit?: number;
};

export type ReconcileSummary = {
	checked: number;
	applied: number;
	expired: number;
	flagged: number;
	failed: number;
};

type Candidate = { id: string; providerPaymentId: string; expiresAt: Date | null };

const MINUTE = 60_000;
const MIN_AGE = 2 * MINUTE;
const MAX_AGE = 24 * 60 * MINUTE;
const BATCH = 100;

/**
 * docs/07 section 7 p. 2-3, 5: pending payments from 2 minutes to a day old are checked at the
 * provider, oldest first. One payment failing does not stop the run.
 */
export async function reconcilePayments(
	db: LimitDb,
	{ providerOf, now = new Date(), effects = paymentEffects, limit = BATCH }: ReconcileDeps
): Promise<ReconcileSummary> {
	const oldest = new Date(now.getTime() - MAX_AGE);
	const summary = { checked: 0, applied: 0, expired: 0, flagged: 0, failed: 0 };
	summary.flagged = await flagStale(db, oldest);
	const rows = await db
		.select({
			id: payments.id,
			provider: payments.provider,
			providerPaymentId: payments.providerPaymentId,
			expiresAt: payments.expiresAt
		})
		.from(payments)
		.where(
			and(
				eq(payments.status, 'pending'),
				isNotNull(payments.providerPaymentId),
				lte(payments.createdAt, new Date(now.getTime() - MIN_AGE)),
				gte(payments.createdAt, oldest)
			)
		)
		.orderBy(asc(payments.createdAt))
		.limit(limit);
	for (const { provider: providerId, providerPaymentId, ...row } of rows) {
		const provider = providerOf(providerId);
		if (!provider?.online || !providerPaymentId) continue;
		summary.checked++;
		try {
			const outcome = await checkOne(db, provider, { ...row, providerPaymentId }, now, effects);
			if (outcome) summary[outcome]++;
		} catch (e) {
			summary.failed++;
			console.error(`reconcile: payment ${row.id} at ${providerId} not settled`, e);
		}
	}
	return summary;
}

async function checkOne(
	db: LimitDb,
	provider: OnlineProvider,
	payment: Candidate,
	now: Date,
	effects: PaymentEffects
): Promise<'applied' | 'expired' | null> {
	const expired = payment.expiresAt !== null && payment.expiresAt <= now;
	const expire = async () =>
		(await expirePayment(db, payment.id, now, effects)) ? ('expired' as const) : null;
	let state: ProviderPaymentState;
	try {
		state = await provider.getStatus(payment.providerPaymentId);
	} catch (e) {
		if (expired && e instanceof PaymentProviderError && e.code === 'not_found') return expire();
		throw e;
	}
	const report = { provider: provider.id, providerPaymentId: payment.providerPaymentId, ...state };
	if ((await applyProviderStatus(db, report, effects)) === 'applied') return 'applied';
	return expired && state.status === 'pending' ? expire() : null;
}

/** docs/07 section 8: the check could not settle it in a day — an admin confirms by the statement. */
async function flagStale(db: LimitDb, oldest: Date): Promise<number> {
	return db.transaction(async (tx) => {
		const rows = await tx
			.update(payments)
			.set({ needsReview: true })
			.where(
				and(
					eq(payments.status, 'pending'),
					eq(payments.needsReview, false),
					lt(payments.createdAt, oldest)
				)
			)
			.returning({
				id: payments.id,
				status: payments.status,
				failureReason: payments.failureReason
			});
		for (const row of rows) {
			await logStatusChange(
				tx,
				row.id,
				{ ...row, needsReview: false },
				{ ...row, needsReview: true }
			);
		}
		return rows.length;
	});
}
