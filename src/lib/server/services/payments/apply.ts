import { and, eq } from 'drizzle-orm';
import type { LimitDb } from '../../auth/rate-limit';
import { payments } from '../../db/schema/payments';
import { paymentEffects, runEffects, type PaymentEffects, type PaymentRow } from './effects';
import type { ProviderStatus } from './providers/types';
import { logStatusChange } from './status-log';
import { canTransition } from './transitions';

/** What the provider says about a payment: a parsed webhook or a status check. */
export type ProviderReport = {
	provider: string;
	providerPaymentId: string;
	status: ProviderStatus;
	amountMinor: number;
	currency: string;
	raw: unknown;
};

export type ApplyResult = 'applied' | 'unchanged' | 'ignored' | 'mismatch' | 'not_found';

const payloadOf = (payment: PaymentRow): Record<string, unknown> => {
	const value = payment.providerPayload;
	return value && typeof value === 'object' && !Array.isArray(value)
		? (value as Record<string, unknown>)
		: {};
};

/* A refusal may come with a zero amount; money is compared only where it moves. */
const moneyMatters = (status: ProviderStatus) => status === 'paid' || status === 'refunded';

/**
 * docs/07 sections 6-8, 10: the one path for webhooks, status checks and reconciliation. The row is
 * locked, so a duplicate waits and then sees the status already applied.
 */
export async function applyProviderStatus(
	db: LimitDb,
	report: ProviderReport,
	effects: PaymentEffects = paymentEffects
): Promise<ApplyResult> {
	return db.transaction(async (tx) => {
		const [payment] = await tx
			.select()
			.from(payments)
			.where(
				and(
					eq(payments.provider, report.provider),
					eq(payments.providerPaymentId, report.providerPaymentId)
				)
			)
			.for('update');
		if (!payment) return 'not_found';
		const payload = { ...payloadOf(payment), last: report.raw };
		const wrongMoney =
			report.amountMinor !== payment.amountMinor || report.currency !== payment.currency;
		if (moneyMatters(report.status) && wrongMoney) {
			if (payment.status !== 'pending' && payment.needsReview) return 'mismatch';
			const failed = payment.status === 'pending';
			console.warn(`payment ${payment.id}: ${report.status} with a different amount or currency`);
			const [flagged] = await tx
				.update(payments)
				.set({
					...(failed && { status: 'failed' as const, failureReason: 'amount_mismatch' }),
					needsReview: true,
					providerPayload: payload
				})
				.where(eq(payments.id, payment.id))
				.returning();
			await logStatusChange(tx, payment.id, payment, flagged);
			return 'mismatch';
		}
		if (report.status === 'pending' || report.status === payment.status) return 'unchanged';
		if (!canTransition(payment.status, report.status)) {
			console.warn(`payment ${payment.id}: ignored ${payment.status} -> ${report.status}`);
			return 'ignored';
		}
		const to = report.status;
		const now = new Date();
		const [updated] = await tx
			.update(payments)
			.set({
				status: to,
				...(to === 'paid' && { paidAt: now }),
				...(to === 'refunded' && { refundedAt: now }),
				...(to === 'failed' && { failureReason: 'provider_failed' }),
				providerPayload: payload
			})
			.where(eq(payments.id, payment.id))
			.returning();
		await runEffects(tx, effects, updated);
		await logStatusChange(tx, payment.id, payment, updated);
		return 'applied';
	});
}
