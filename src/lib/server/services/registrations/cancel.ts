import { and, eq, isNull } from 'drizzle-orm';
import type { LimitDb } from '../../auth/rate-limit';
import { events } from '../../db/schema/events';
import { eventRegistrations } from '../../db/schema/registrations';
import type { Mail } from '../../mail/resend';
import { isUuid } from '../users/target';
import { holdsSeat } from './seats';
import { fillFromWaitlist, sendLetters, type WaitlistDeps } from './waitlist';

/* docs/03 section 7.5, docs/04 section 3.1: the member cancels their own registration before the
 * start (a seat — `cancel_hours` before it); the freed seat goes to the waitlist. A refund is the
 * admin's decision; points for the registration are taken back in 5.6. */

export type CancelDeps = WaitlistDeps & { send: (mail: Mail) => Promise<void> };
export type CancelResult = 'ok' | 'not_found' | 'wrong_status' | 'too_late';

const CANCELLABLE = ['registered', 'pending_payment', 'waitlist'];

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
			.select({ startsAt: events.startsAt })
			.from(events)
			.where(and(eq(events.id, eventId), isNull(events.deletedAt)))
			.for('update');
		if (!event) return 'not_found' as const;
		const [row] = await tx
			.select({ id: eventRegistrations.id, status: eventRegistrations.status })
			.from(eventRegistrations)
			.where(and(eq(eventRegistrations.eventId, eventId), eq(eventRegistrations.userId, userId)))
			.for('update');
		if (!row) return 'not_found' as const;
		if (!CANCELLABLE.includes(row.status)) return 'wrong_status' as const;
		const seat = holdsSeat(row.status);
		const deadline = event.startsAt.getTime() - (seat ? deps.settings.cancelHours * 3_600_000 : 0);
		if (now.getTime() >= deadline) return 'too_late' as const;
		await tx
			.update(eventRegistrations)
			.set({ status: 'cancelled', holdUntil: null })
			.where(eq(eventRegistrations.id, row.id));
		return seat ? fillFromWaitlist(tx, eventId, deps, now) : [];
	});
	if (typeof outcome === 'string') return outcome;
	await sendLetters(deps.send, outcome);
	return 'ok';
}
