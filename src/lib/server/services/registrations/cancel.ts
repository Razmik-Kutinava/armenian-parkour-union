import { and, eq, isNull } from 'drizzle-orm';
import type { LimitDb } from '../../auth/rate-limit';
import { events } from '../../db/schema/events';
import { eventRegistrations } from '../../db/schema/registrations';
import type { Mail } from '../../mail/resend';
import { isUuid } from '../users/target';
import type { RegistrationStatus } from './admission';
import { takeBackRegistration } from './points';
import { holdsSeat } from './seats';
import type { RegistrationSettings } from './settings';
import { settleCancelledPayment } from './settle-cancel';
import { fillFromWaitlist, sendLetters, type WaitlistDeps } from './waitlist';

/* docs/03 section 7.5, docs/04 section 3.1: the member cancels their own registration before the
 * start (a seat — `cancel_hours` before it); the freed seat goes to the waitlist. A refund is the
 * admin's decision (settle-cancel.ts); points for the registration are taken back (points.ts). */

export type CancelDeps = WaitlistDeps & { send: (mail: Mail) => Promise<void> };
export type CancelResult = 'ok' | 'not_found' | 'wrong_status' | 'too_late';

export const CANCELLABLE: RegistrationStatus[] = ['registered', 'pending_payment', 'waitlist'];

/** A seat may be given back until `cancel_hours` before the start, a place in line until the start. */
export function cancelDeadline(
	startsAt: Date,
	status: RegistrationStatus,
	settings: RegistrationSettings
): Date {
	const hours = holdsSeat(status) ? settings.cancelHours : 0;
	return new Date(startsAt.getTime() - hours * 3_600_000);
}

export async function cancelRegistration(
	db: LimitDb,
	userId: string,
	eventId: string,
	deps: CancelDeps,
	now = new Date()
): Promise<CancelResult> {
	if (!isUuid(userId) || !isUuid(eventId)) return 'not_found';
	const outcome = await db.transaction(async (tx) => {
		const [event] = await tx
			.select({ startsAt: events.startsAt, title: events.title })
			.from(events)
			.where(and(eq(events.id, eventId), isNull(events.deletedAt)))
			.for('update');
		if (!event) return 'not_found' as const;
		const [row] = await tx
			.select({
				id: eventRegistrations.id,
				status: eventRegistrations.status,
				paymentId: eventRegistrations.paymentId
			})
			.from(eventRegistrations)
			.where(and(eq(eventRegistrations.eventId, eventId), eq(eventRegistrations.userId, userId)))
			.for('update');
		if (!row) return 'not_found' as const;
		if (!CANCELLABLE.includes(row.status)) return 'wrong_status' as const;
		const seat = holdsSeat(row.status);
		const deadline = cancelDeadline(event.startsAt, row.status, deps.settings);
		if (now >= deadline) return 'too_late' as const;
		await tx
			.update(eventRegistrations)
			.set({ status: 'cancelled', holdUntil: null })
			.where(eq(eventRegistrations.id, row.id));
		if (seat) await takeBackRegistration(tx, { id: row.id, userId }, event, now);
		const letters = seat ? await fillFromWaitlist(tx, eventId, deps, now) : [];
		return { letters, paymentId: seat ? row.paymentId : null, id: row.id };
	});
	if (typeof outcome === 'string') return outcome;
	if (outcome.paymentId) {
		await settleCancelledPayment(db, outcome.paymentId, { id: outcome.id, eventId }).catch((e) =>
			console.error(`registration ${outcome.id}: payment ${outcome.paymentId} not settled`, e)
		);
	}
	await sendLetters(deps.send, outcome.letters);
	return 'ok';
}
