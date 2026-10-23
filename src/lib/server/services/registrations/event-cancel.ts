import { and, count, eq, inArray } from 'drizzle-orm';
import type { LimitDb } from '../../auth/rate-limit';
import { eventRegistrations } from '../../db/schema/registrations';
import { CANCELLABLE } from './cancel';
import { takeBackRegistration } from './points';
import { settleCancelledPayment } from './settle-cancel';

/* docs/03 section 7 p. 8, section 6.2 p. 6: the event is cancelled — its active registrations go
 * with it, the registration points too (before the start); "attended" and "no show" stay. */

type Cancelled = { id: string; paymentId: string | null };

/** Inside the event cancel, the event row locked already; the waitlist does not move. */
export async function cancelEventRegistrations(
	tx: LimitDb,
	event: { id: string; title: unknown; startsAt: Date },
	now = new Date()
): Promise<Cancelled[]> {
	const rows = await tx
		.update(eventRegistrations)
		.set({ status: 'cancelled', holdUntil: null })
		.where(
			and(eq(eventRegistrations.eventId, event.id), inArray(eventRegistrations.status, CANCELLABLE))
		)
		.returning({
			id: eventRegistrations.id,
			userId: eventRegistrations.userId,
			paymentId: eventRegistrations.paymentId
		});
	for (const row of rows) await takeBackRegistration(tx, row, event, now);
	return rows.map(({ id, paymentId }) => ({ id, paymentId }));
}

/** After the commit: a waiting payment is cancelled, a paid one goes to review. */
export async function settleEventPayments(db: LimitDb, eventId: string, cancelled: Cancelled[]) {
	for (const { id, paymentId } of cancelled) {
		if (!paymentId) continue;
		await settleCancelledPayment(db, paymentId, { id, eventId }, 'event_cancelled').catch((e) =>
			console.error(`registration ${id}: payment ${paymentId} not settled`, e)
		);
	}
}

/** Any registration row, whatever its status: it keeps the history and the payment link. */
export async function hasRegistrations(
	tx: LimitDb,
	where: { eventId: string } | { categoryId: string }
): Promise<boolean> {
	const [row] = await tx
		.select({ n: count() })
		.from(eventRegistrations)
		.where(
			'eventId' in where
				? eq(eventRegistrations.eventId, where.eventId)
				: eq(eventRegistrations.categoryId, where.categoryId)
		);
	return row.n > 0;
}
