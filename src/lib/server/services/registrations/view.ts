import { and, eq, isNull } from 'drizzle-orm';
import type { LimitDb } from '../../auth/rate-limit';
import { events } from '../../db/schema/events';
import { eventRegistrations } from '../../db/schema/registrations';
import { isUuid } from '../users/target';
import { checkAdmission, type AdmissionInput, type Refusal } from './admission';
import { readAdmission, readMember } from './admission-data';
import { CANCELLABLE, cancelDeadline } from './cancel';
import { hasSeat, readSeats } from './seats';
import type { RegistrationSettings } from './settings';

/* docs/06 section 4.3: what the registration block shows. Plain reads, no locks: the form action
 * runs the same `checkAdmission` again inside the registration transaction (register.ts). */

export type ViewRefusal = Refusal | 'payment_unavailable';
type OwnStatus = 'registered' | 'pending_payment' | 'waitlist' | 'attended' | 'no_show';

export type RegistrationView =
	| { state: 'none' }
	| { state: 'guest' }
	| { state: 'refused'; reason: ViewRefusal; opensAt: Date | null }
	/** `full` — no seat in any allowed category: the button joins the waitlist. */
	| { state: 'open'; full: boolean; categories: { id: string; full: boolean }[] }
	/** `cancelUntil: null` — too late (or nothing to cancel). */
	| {
			state: 'mine';
			status: OwnStatus;
			holdUntil: Date | null;
			expired: boolean;
			cancelUntil: Date | null;
	  };

/** `paymentsOn: false` — a paid event takes no new registrations (register.ts refuses too). */
export type ViewDeps = { settings: RegistrationSettings; paymentsOn: boolean };

const refused = (reason: ViewRefusal, opensAt: Date | null = null): RegistrationView => ({
	state: 'refused',
	reason,
	opensAt
});

/** Registration is shown only for a published event that is on the site. */
async function readEvent(db: LimitDb, eventId: string, now: Date) {
	const [event] = await db
		.select()
		.from(events)
		.where(and(eq(events.id, eventId), isNull(events.deletedAt)));
	if (!event || event.status !== 'published' || !event.publishedAt) return null;
	return event.publishedAt <= now ? event : null;
}

async function readOwn(db: LimitDb, eventId: string, userId: string) {
	const [row] = await db
		.select({ status: eventRegistrations.status, holdUntil: eventRegistrations.holdUntil })
		.from(eventRegistrations)
		.where(and(eq(eventRegistrations.eventId, eventId), eq(eventRegistrations.userId, userId)));
	return row && row.status !== 'cancelled' ? { ...row, status: row.status as OwnStatus } : null;
}

export async function registrationView(
	db: LimitDb,
	userId: string | null,
	eventId: string,
	deps: ViewDeps,
	now = new Date()
): Promise<RegistrationView> {
	if (!isUuid(eventId)) return { state: 'none' };
	const event = await readEvent(db, eventId, now);
	if (!event) return { state: 'none' };
	if (!userId) return { state: 'guest' };
	const own = await readOwn(db, eventId, userId);
	if (own) {
		const deadline = cancelDeadline(event.startsAt, own.status, deps.settings);
		const cancellable = CANCELLABLE.includes(own.status) && now < deadline;
		return {
			state: 'mine',
			status: own.status,
			holdUntil: own.holdUntil,
			expired: own.status === 'pending_payment' && (!own.holdUntil || own.holdUntil <= now),
			cancelUntil: cancellable ? deadline : null
		};
	}
	const user = await readMember(db, userId);
	if (!user) return { state: 'none' };
	const { facts } = await readAdmission(db, eventId, userId, now, false);
	const input: AdmissionInput = { now, event, user, ...facts, categories: [], categoryId: null };
	const refusal = checkAdmission(input);
	if (refusal) return refused(refusal, refusal === 'not_open' ? event.registrationOpensAt : null);

	const allowed = facts.categories.filter(
		(c) => checkAdmission({ ...input, categories: facts.categories, categoryId: c.id }) === null
	);
	if (facts.categories.length > 0 && allowed.length === 0) return refused('age_mismatch');
	if (event.priceAmountMinor > 0 && !deps.paymentsOn) return refused('payment_unavailable');

	const seats = await readSeats(db, eventId, event.capacity);
	const categories = allowed.map((c) => ({ id: c.id, full: !hasSeat(seats, c.id) }));
	const full = categories.length > 0 ? categories.every((c) => c.full) : !hasSeat(seats, null);
	return { state: 'open', full, categories };
}
