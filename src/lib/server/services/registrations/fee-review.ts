import { eq } from 'drizzle-orm';
import type { LimitDb } from '../../auth/rate-limit';
import { payments } from '../../db/schema/payments';
import { writeAudit } from '../audit';

export type FeeReview =
	| 'registration_missing'
	| 'user_blocked'
	| 'registration_already_active'
	| 'late_payment_no_seat'
	| 'cancelled_by_member'
	| 'cancelled_by_staff'
	| 'event_cancelled';

/** docs/07 section 8: the money is kept, an admin decides (list "Needs review"). */
export async function reviewEventFee(
	tx: LimitDb,
	paymentId: string,
	reason: FeeReview,
	registration: { id: string; eventId: string } | null = null
) {
	await tx.update(payments).set({ needsReview: true }).where(eq(payments.id, paymentId));
	await writeAudit(tx, {
		actorId: null,
		action: 'event_fee.review',
		entityType: 'payment',
		entityId: paymentId,
		after: {
			reason,
			registrationId: registration?.id ?? null,
			eventId: registration?.eventId ?? null
		}
	});
}
