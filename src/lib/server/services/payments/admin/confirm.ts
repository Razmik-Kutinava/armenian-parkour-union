import { eq } from 'drizzle-orm';
import type { LimitDb } from '../../../auth/rate-limit';
import { payments } from '../../../db/schema/payments';
import { writeAudit } from '../../audit';
import type { Actor } from '../../users/target';
import { runEffects, withAfterCommit, type PaymentEffects } from '../effects';
import { canTransition } from '../transitions';
import { canManage, lockPayment, type AdminPaymentResult } from './support';

export type ConfirmDeps = { effects: PaymentEffects; ip: string | null };

/**
 * docs/07 sections 8, 10: the money is in the bank statement, the site still waits. The amount
 * stays; the paid effects run once (a repeat finds the payment already paid).
 */
export async function confirmPaymentManually(
	db: LimitDb,
	actor: Actor,
	paymentId: string,
	comment: string,
	deps: ConfirmDeps
): Promise<AdminPaymentResult> {
	if (!canManage(actor)) return 'not_allowed';
	const text = comment.trim();
	if (!text) return 'invalid';
	return withAfterCommit((after) =>
		db.transaction(async (tx): Promise<AdminPaymentResult> => {
			const payment = await lockPayment(tx, paymentId);
			if (!payment) return 'not_found';
			if (!canTransition(payment.status, 'paid')) return 'wrong_status';
			const [paid] = await tx
				.update(payments)
				.set({ status: 'paid', paidAt: new Date(), confirmedBy: actor.id, needsReview: false })
				.where(eq(payments.id, payment.id))
				.returning();
			await runEffects(tx, deps.effects, paid, after);
			await writeAudit(tx, {
				actorId: actor.id,
				action: 'payment.confirm_manual',
				entityType: 'payment',
				entityId: payment.id,
				before: { status: payment.status, needsReview: payment.needsReview },
				after: { status: 'paid', comment: text },
				ip: deps.ip
			});
			return 'ok';
		})
	);
}
