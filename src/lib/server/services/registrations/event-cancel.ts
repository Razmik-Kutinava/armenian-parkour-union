import { and, count, eq, inArray } from 'drizzle-orm';
import type { LimitDb } from '../../auth/rate-limit';
import { eventRegistrations } from '../../db/schema/registrations';
import { users } from '../../db/schema/users';
import { CANCELLABLE } from './cancel';
import {
	eventCancelledLetter,
	type EventRef,
	type LetterDeps,
	type RegistrationRecipient
} from './mail';
import { takeBackRegistration } from './points';
import { RECIPIENT } from './recipient';
import { settleCancelledPayment } from './settle-cancel';
import { sendLetters } from './waitlist';

/* docs/03 section 7 p. 8, section 6.2 p. 6: the event is cancelled — its active registrations go
 * with it, the registration points too (before the start); "attended" and "no show" stay. */

/** `paid` — a counted seat with a payment: the letter says the refund is the admin's to make. */
export type Cancelled = {
	id: string;
	paymentId: string | null;
	paid: boolean;
	to: RegistrationRecipient;
};

/** Inside the event cancel, the event row locked already; the waitlist does not move. */
export async function cancelEventRegistrations(
	tx: LimitDb,
	event: { id: string; title: unknown; startsAt: Date },
	now = new Date()
): Promise<Cancelled[]> {
	const rows = await tx
		.select({
			id: eventRegistrations.id,
			userId: eventRegistrations.userId,
			status: eventRegistrations.status,
			paymentId: eventRegistrations.paymentId,
			to: RECIPIENT
		})
		.from(eventRegistrations)
		.innerJoin(users, eq(users.id, eventRegistrations.userId))
		.where(
			and(eq(eventRegistrations.eventId, event.id), inArray(eventRegistrations.status, CANCELLABLE))
		)
		.for('update', { of: eventRegistrations });
	if (rows.length === 0) return [];
	await tx
		.update(eventRegistrations)
		.set({ status: 'cancelled', holdUntil: null })
		.where(
			inArray(
				eventRegistrations.id,
				rows.map((row) => row.id)
			)
		);
	for (const row of rows) await takeBackRegistration(tx, row, event, now);
	return rows.map(({ id, paymentId, status, to }) => ({
		id,
		paymentId,
		paid: status === 'registered' && paymentId !== null,
		to
	}));
}

/** After the commit and the payments: one letter per cancelled registration (docs/03 section 14). */
export async function sendEventCancelled(
	mail: LetterDeps,
	event: EventRef,
	cancelled: Cancelled[]
) {
	const letters = cancelled.map((c) => eventCancelledLetter(c.to, event, c.paid, mail.siteUrl));
	await sendLetters(mail.send, letters);
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
