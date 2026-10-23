import { and, eq } from 'drizzle-orm';
import type { LimitDb } from '../../auth/rate-limit';
import { events } from '../../db/schema/events';
import { eventRegistrations } from '../../db/schema/registrations';
import { users } from '../../db/schema/users';
import type { Mail } from '../../mail/resend';
import type { AfterCommit, PaymentEffect, PaymentRow } from '../payments/effects';
import { feePaidLetter } from './fee-mail';
import { reviewEventFee } from './fee-review';
import type { RegistrationRecipient } from './mail';
import { awardRegistration, takeBackRegistration } from './points';
import { RECIPIENT } from './recipient';
import { hasSeat, readSeats } from './seats';
import type { RegistrationSettings } from './settings';
import { fillFromWaitlist, sendLetters } from './waitlist';

/* docs/07 sections 5.3 p. 3-5, 11 p. 3. Inside the payment transaction: the payment row is locked
 * already, then the event row, then the registration. Registration code never locks a payment
 * after the event, so the two paths cannot wait on each other in a circle. Failed or cancelled —
 * nothing here: the seat stays held until `hold_until` (release.ts). */

export type EventFeeDeps = {
	send: (mail: Mail) => Promise<void>;
	siteUrl: string | undefined;
	settings: (tx: LimitDb) => Promise<RegistrationSettings>;
};

/** The registration this payment is for, with its event; both locked. */
async function lockFeeRegistration(tx: LimitDb, paymentId: string) {
	const [found] = await tx
		.select({ eventId: eventRegistrations.eventId })
		.from(eventRegistrations)
		.where(eq(eventRegistrations.paymentId, paymentId))
		.limit(1);
	if (!found) return null;
	const [event] = await tx.select().from(events).where(eq(events.id, found.eventId)).for('update');
	const [registration] = await tx
		.select()
		.from(eventRegistrations)
		.where(
			and(eq(eventRegistrations.eventId, event.id), eq(eventRegistrations.paymentId, paymentId))
		)
		.for('update');
	return registration ? { event, registration } : null;
}

async function setStatus(tx: LimitDb, id: string, status: 'registered' | 'cancelled') {
	await tx
		.update(eventRegistrations)
		.set({ status, holdUntil: null })
		.where(eq(eventRegistrations.id, id));
}

type Locked = NonNullable<Awaited<ReturnType<typeof lockFeeRegistration>>>;

/**
 * The paid seat counts, and so do the registration points (docs/03 section 6.2 p. 5); the letter
 * with the receipt goes after the commit (docs/07 section 12 p. 1).
 */
async function admit(
	tx: LimitDb,
	{ event, registration }: Locked,
	to: RegistrationRecipient,
	payment: PaymentRow,
	after: AfterCommit,
	deps: EventFeeDeps
) {
	await setStatus(tx, registration.id, 'registered');
	await awardRegistration(tx, registration);
	const letter = await feePaidLetter(tx, to, event, payment, deps.siteUrl);
	after(() => sendLetters(deps.send, [letter]));
}

/** Paid in time — counts; paid after the seat was released — only into a free seat (p. 5). */
async function countIn(tx: LimitDb, payment: PaymentRow, after: AfterCommit, deps: EventFeeDeps) {
	const locked = await lockFeeRegistration(tx, payment.id);
	if (!locked) return reviewEventFee(tx, payment.id, 'registration_missing');
	const { event, registration } = locked;
	const ref = { id: registration.id, eventId: event.id };
	const [user] = await tx
		.select({ status: users.status, deletedAt: users.deletedAt, ...RECIPIENT })
		.from(users)
		.where(eq(users.id, registration.userId));
	if (user?.status !== 'active' || user.deletedAt) {
		return reviewEventFee(tx, payment.id, 'user_blocked', ref);
	}
	const count = () => admit(tx, locked, user, payment, after, deps);
	if (registration.status === 'pending_payment') return count();
	if (registration.status !== 'cancelled' && registration.status !== 'waitlist') {
		return reviewEventFee(tx, payment.id, 'registration_already_active', ref);
	}
	const open = event.status === 'published' && !event.deletedAt && event.startsAt > new Date();
	if (open && hasSeat(await readSeats(tx, event.id, event.capacity), registration.categoryId)) {
		return count();
	}
	return reviewEventFee(tx, payment.id, 'late_payment_no_seat', ref);
}

/** Refunded: the seat is given back, before the start — with the points; attendance stays. */
async function giveBack(tx: LimitDb, payment: PaymentRow, after: AfterCommit, deps: EventFeeDeps) {
	const locked = await lockFeeRegistration(tx, payment.id);
	const status = locked?.registration.status;
	if (!locked || (status !== 'registered' && status !== 'pending_payment')) return;
	await setStatus(tx, locked.registration.id, 'cancelled');
	await takeBackRegistration(tx, locked.registration, locked.event);
	const waitlist = { settings: await deps.settings(tx), siteUrl: deps.siteUrl };
	const letters = await fillFromWaitlist(tx, locked.event.id, waitlist);
	after(() => sendLetters(deps.send, letters));
}

export function eventFeeEffects(
	deps: EventFeeDeps
): Partial<Record<'paid' | 'refunded', PaymentEffect>> {
	return {
		paid: (tx, payment, after) => countIn(tx, payment, after, deps),
		refunded: (tx, payment, after) => giveBack(tx, payment, after, deps)
	};
}
