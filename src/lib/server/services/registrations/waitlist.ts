import { and, asc, eq, isNull } from 'drizzle-orm';
import type { LimitDb } from '../../auth/rate-limit';
import { events } from '../../db/schema/events';
import { eventRegistrations } from '../../db/schema/registrations';
import { users } from '../../db/schema/users';
import type { Mail } from '../../mail/resend';
import { promotedLetter } from './mail';
import { hasSeat, readSeats, takeSeat } from './seats';
import type { RegistrationSettings } from './settings';

/* docs/03 section 7.3: when a seat frees up, the first in line takes it; a paid event gives them
 * `offer_hours` to pay. Members whose category is still full keep their place in line. */

export type WaitlistDeps = { settings: RegistrationSettings; siteUrl: string | undefined };

/**
 * Inside the caller's transaction; locks the event row first like every registration change.
 * Returns the letters: the caller sends them after the commit.
 */
export async function fillFromWaitlist(
	tx: LimitDb,
	eventId: string,
	deps: WaitlistDeps,
	now = new Date()
): Promise<Mail[]> {
	const [event] = await tx
		.select()
		.from(events)
		.where(and(eq(events.id, eventId), isNull(events.deletedAt)))
		.for('update');
	if (!event || event.status !== 'published' || event.startsAt <= now) return [];
	const queue = await tx
		.select({
			id: eventRegistrations.id,
			categoryId: eventRegistrations.categoryId,
			user: {
				email: users.email,
				locale: users.locale,
				firstName: users.firstName,
				name: users.name
			}
		})
		.from(eventRegistrations)
		.innerJoin(users, eq(users.id, eventRegistrations.userId))
		.where(and(eq(eventRegistrations.eventId, eventId), eq(eventRegistrations.status, 'waitlist')))
		.orderBy(asc(eventRegistrations.registeredAt), asc(eventRegistrations.id))
		.for('update', { of: eventRegistrations });
	if (queue.length === 0) return [];
	const seats = await readSeats(tx, eventId, event.capacity);
	const paid = event.priceAmountMinor > 0;
	const holdUntil = paid ? new Date(now.getTime() + deps.settings.offerHours * 3_600_000) : null;
	const letters: Mail[] = [];
	for (const row of queue) {
		if (!hasSeat(seats, null)) break;
		if (!hasSeat(seats, row.categoryId)) continue;
		takeSeat(seats, row.categoryId);
		await tx
			.update(eventRegistrations)
			.set({ status: paid ? 'pending_payment' : 'registered', holdUntil })
			.where(eq(eventRegistrations.id, row.id));
		letters.push(promotedLetter(row.user, event, holdUntil, deps.siteUrl));
	}
	return letters;
}

/** docs/03 section 14: a failed letter is logged and does not undo the change. */
export async function sendLetters(send: (mail: Mail) => Promise<void>, letters: Mail[]) {
	for (const mail of letters) {
		await send(mail).catch((e) => console.warn(`registration letter to ${mail.to} not sent`, e));
	}
}
