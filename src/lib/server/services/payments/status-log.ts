import type { LimitDb } from '../../auth/rate-limit';
import { writeAudit } from '../audit';
import type { PaymentRow } from './effects';

type StatusState = Pick<PaymentRow, 'status' | 'failureReason' | 'needsReview'>;

const state = ({ status, failureReason, needsReview }: StatusState) => ({
	status,
	failureReason,
	needsReview
});

/** One entry per status change; `actorId = null` — the provider or automation (docs/07 section 7 p. 5). */
export async function logStatusChange(
	tx: LimitDb,
	paymentId: string,
	before: StatusState,
	after: StatusState,
	actorId: string | null = null
) {
	await writeAudit(tx, {
		actorId,
		action: 'payment.status',
		entityType: 'payment',
		entityId: paymentId,
		before: state(before),
		after: state(after)
	});
}
