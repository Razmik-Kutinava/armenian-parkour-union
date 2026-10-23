import { eq } from 'drizzle-orm';
import type { LimitDb } from '../../auth/rate-limit';
import { payments } from '../../db/schema/payments';
import { logStatusChange } from '../payments/status-log';
import { reviewEventFee } from './fee-review';

const FAILURE = {
	cancelled_by_member: 'registration_cancelled',
	cancelled_by_staff: 'registration_cancelled',
	event_cancelled: 'event_cancelled'
} as const;

/**
 * docs/03 section 7.5, 7.8: the member cancelled or the event was cancelled — a waiting payment is
 * cancelled, a paid one goes to an admin (the refund is their decision). Runs after the cancel's
 * commit in its own transaction, the payment row locked first like the payment service does.
 */
export async function settleCancelledPayment(
	db: LimitDb,
	paymentId: string,
	registration: { id: string; eventId: string },
	why: keyof typeof FAILURE = 'cancelled_by_member'
) {
	await db.transaction(async (tx) => {
		const [payment] = await tx
			.select()
			.from(payments)
			.where(eq(payments.id, paymentId))
			.for('update');
		if (payment?.kind !== 'event_fee') return;
		if (payment.status === 'paid') {
			return reviewEventFee(tx, payment.id, why, registration);
		}
		if (payment.status !== 'pending') return;
		const [cancelled] = await tx
			.update(payments)
			.set({ status: 'cancelled', failureReason: FAILURE[why] })
			.where(eq(payments.id, payment.id))
			.returning();
		await logStatusChange(tx, payment.id, payment, cancelled);
	});
}
