import { eq } from 'drizzle-orm';
import type { LimitDb } from '../../../auth/rate-limit';
import { payments } from '../../../db/schema/payments';
import { writeAudit } from '../../audit';
import type { Actor } from '../../users/target';
import { canManage, lockPayment, type AdminPaymentResult } from './support';

/** docs/05 section 16, "needs review": the admin has checked the case and says what was found. */
export async function resolveReview(
	db: LimitDb,
	actor: Actor,
	paymentId: string,
	comment: string,
	ip: string | null
): Promise<AdminPaymentResult> {
	if (!canManage(actor)) return 'not_allowed';
	const text = comment.trim();
	if (!text) return 'invalid';
	return db.transaction(async (tx): Promise<AdminPaymentResult> => {
		const payment = await lockPayment(tx, paymentId);
		if (!payment) return 'not_found';
		if (!payment.needsReview) return 'wrong_status';
		await tx.update(payments).set({ needsReview: false }).where(eq(payments.id, payment.id));
		await writeAudit(tx, {
			actorId: actor.id,
			action: 'payment.review_resolved',
			entityType: 'payment',
			entityId: payment.id,
			before: { needsReview: true },
			after: { needsReview: false, comment: text },
			ip
		});
		return 'ok';
	});
}
