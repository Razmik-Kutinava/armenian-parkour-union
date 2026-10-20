import { eq } from 'drizzle-orm';
import type { LimitDb } from '../../../auth/rate-limit';
import { payments } from '../../../db/schema/payments';
import { writeAudit } from '../../audit';
import type { Actor } from '../../users/target';
import { runEffects, withAfterCommit, type PaymentEffects, type PaymentRow } from '../effects';
import type { PaymentProvider } from '../providers/types';
import { canManage, lockPayment, type AdminPaymentResult } from './support';

export type RefundMode = 'api' | 'manual';
export type ProviderOf = (id: string) => PaymentProvider | null;
export type RefundDeps = { effects: PaymentEffects; providerOf: ProviderOf; ip: string | null };

/**
 * docs/07 section 11 p. 2: through the provider when it refunds over the API and the money went
 * through it; a manually confirmed payment came by transfer, so the admin returns it in the bank.
 */
export function refundMode(
	payment: Pick<PaymentRow, 'provider' | 'providerPaymentId' | 'confirmedBy'>,
	providerOf: ProviderOf
): RefundMode {
	const provider = providerOf(payment.provider);
	const api = provider?.online && provider.refund && payment.providerPaymentId;
	return api && !payment.confirmedBy ? 'api' : 'manual';
}

/** The provider's answer, or `null` when it refused or could not be reached. */
async function refundAtProvider(payment: PaymentRow, deps: RefundDeps, reason: string) {
	const provider = deps.providerOf(payment.provider);
	if (!provider?.online || !provider.refund) return null;
	try {
		const result = await provider.refund(payment.providerPaymentId!, payment.amountMinor, reason);
		if (result.ok) return result.raw ?? {};
		console.warn(`payment ${payment.id}: provider ${provider.id} refused the refund`);
	} catch (error) {
		console.error(`payment ${payment.id}: refund at ${provider.id} failed`, error);
	}
	return null;
}

const payloadOf = (payment: PaymentRow): Record<string, unknown> => {
	const value = payment.providerPayload;
	return value && typeof value === 'object' && !Array.isArray(value)
		? (value as Record<string, unknown>)
		: {};
};

/** docs/07 sections 10-11: paid → refunded, full amount, a reason; effects and the letter once. */
export async function refundPayment(
	db: LimitDb,
	actor: Actor,
	paymentId: string,
	reason: string,
	deps: RefundDeps
): Promise<AdminPaymentResult> {
	if (!canManage(actor)) return 'not_allowed';
	const text = reason.trim();
	if (!text) return 'invalid';
	return withAfterCommit((after) =>
		db.transaction(async (tx): Promise<AdminPaymentResult> => {
			const payment = await lockPayment(tx, paymentId);
			if (!payment) return 'not_found';
			if (payment.status !== 'paid') return 'wrong_status';
			const mode = refundMode(payment, deps.providerOf);
			let raw: unknown = null;
			if (mode === 'api') {
				raw = await refundAtProvider(payment, deps, text);
				if (raw === null) return 'provider_error';
			}
			const [refunded] = await tx
				.update(payments)
				.set({
					status: 'refunded',
					refundedAt: new Date(),
					...(mode === 'api' && { providerPayload: { ...payloadOf(payment), refund: raw } })
				})
				.where(eq(payments.id, payment.id))
				.returning();
			await runEffects(tx, deps.effects, refunded, after);
			await writeAudit(tx, {
				actorId: actor.id,
				action: 'payment.refund',
				entityType: 'payment',
				entityId: payment.id,
				before: { status: 'paid' },
				after: { status: 'refunded', reason: text, mode },
				ip: deps.ip
			});
			return 'ok';
		})
	);
}
