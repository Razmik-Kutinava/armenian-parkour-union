import { and, asc, eq, lte } from 'drizzle-orm';
import type { LimitDb } from '../../auth/rate-limit';
import { events } from '../../db/schema/events';
import { payments } from '../../db/schema/payments';
import { eventRegistrations } from '../../db/schema/registrations';
import { users } from '../../db/schema/users';
import type { Mail } from '../../mail/resend';
import type { CancelDeps } from './cancel';
import { holdExpiredLetter } from './cancel-mail';
import { RECIPIENT } from './recipient';
import { fillFromWaitlist, sendLetters } from './waitlist';

/* docs/03 section 7.4, docs/07 section 5.3 p. 4: an unpaid registration gives its seat back when
 * `hold_until` passes. A payment still at the provider is left to reconciliation, which runs first
 * (its expiry is never later than the hold, pay.ts). Event row, then registration, like every
 * registration change; the payment is only read, a late `paid` goes the late-payment way.
 * The member is told the seat is gone (owner's answer 2026-10-26). */

const BATCH = 100;

type Due = { id: string; eventId: string };

async function releaseOne(tx: LimitDb, due: Due, deps: CancelDeps, now: Date) {
	const [event] = await tx
		.select({ slug: events.slug, title: events.title, startsAt: events.startsAt })
		.from(events)
		.where(eq(events.id, due.eventId))
		.for('update');
	const [row] = await tx
		.select({ paymentId: eventRegistrations.paymentId, to: RECIPIENT })
		.from(eventRegistrations)
		.innerJoin(users, eq(users.id, eventRegistrations.userId))
		.where(
			and(
				eq(eventRegistrations.id, due.id),
				eq(eventRegistrations.status, 'pending_payment'),
				lte(eventRegistrations.holdUntil, now)
			)
		)
		.for('update', { of: eventRegistrations });
	if (!row) return null;
	if (row.paymentId) {
		const [payment] = await tx
			.select({ status: payments.status })
			.from(payments)
			.where(eq(payments.id, row.paymentId));
		if (payment?.status === 'pending') return null;
	}
	await tx
		.update(eventRegistrations)
		.set({ status: 'cancelled', holdUntil: null })
		.where(eq(eventRegistrations.id, due.id));
	const own = holdExpiredLetter(row.to, event, deps.siteUrl);
	return [own, ...(await fillFromWaitlist(tx, due.eventId, deps, now))];
}

/** Oldest holds first, one transaction each; one failing does not stop the run. */
export async function releaseExpiredHolds(
	db: LimitDb,
	deps: CancelDeps,
	now = new Date(),
	limit = BATCH
): Promise<number> {
	const due = await db
		.select({ id: eventRegistrations.id, eventId: eventRegistrations.eventId })
		.from(eventRegistrations)
		.where(
			and(eq(eventRegistrations.status, 'pending_payment'), lte(eventRegistrations.holdUntil, now))
		)
		.orderBy(asc(eventRegistrations.holdUntil))
		.limit(limit);
	let released = 0;
	for (const row of due) {
		let letters: Mail[] | null;
		try {
			letters = await db.transaction((tx) => releaseOne(tx, row, deps, now));
		} catch (e) {
			console.error(`registrations: hold ${row.id} not released`, e);
			continue;
		}
		if (!letters) continue;
		released++;
		await sendLetters(deps.send, letters);
	}
	return released;
}
