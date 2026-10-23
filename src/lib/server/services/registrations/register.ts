import { eq, sql } from 'drizzle-orm';
import type { LimitDb } from '../../auth/rate-limit';
import { eventRegistrations } from '../../db/schema/registrations';
import { isUuid } from '../users/target';
import { checkAdmission, type Refusal } from './admission';
import { lockShownEvent, readAdmission, readMember } from './admission-data';
import { hasSeat, readSeats } from './seats';
import type { RegistrationSettings } from './settings';

/* docs/03 section 7.2–7.4: one transaction with the event row locked first, so registrations and
 * cancels of one event go one at a time and the limit holds under simultaneous clicks. */

export type RegisterInput = { eventId: string; categoryId: string | null };
export type RegisterResult =
	| {
			ok: true;
			id: string;
			status: 'registered' | 'pending_payment' | 'waitlist';
			holdUntil: Date | null;
	  }
	| { ok: false; reason: Refusal | 'not_found' };

const refuse = (reason: Refusal | 'not_found') => ({ ok: false, reason }) as const;

/* An earlier payment is unlinked: the cancel already sent a paid one to review (settle-cancel.ts). */
const CLEARED = { attendedAt: null, place: null, score: null, resultNote: null, paymentId: null };

export async function registerForEvent(
	db: LimitDb,
	userId: string,
	input: RegisterInput,
	deps: { settings: RegistrationSettings },
	now = new Date()
): Promise<RegisterResult> {
	if (!isUuid(userId) || !isUuid(input.eventId)) return refuse('not_found');
	if (input.categoryId !== null && !isUuid(input.categoryId)) return refuse('category_invalid');
	return db.transaction(async (tx) => {
		const event = await lockShownEvent(tx, input.eventId, now);
		const user = event && (await readMember(tx, userId));
		if (!event || !user) return refuse('not_found');
		if (event.status !== 'published') return refuse('closed');
		const { existingId, facts } = await readAdmission(tx, event.id, userId, now);
		const refusal = checkAdmission({ now, event, user, categoryId: input.categoryId, ...facts });
		if (refusal) return refuse(refusal);

		const seats = await readSeats(tx, event.id, event.capacity);
		const status = !hasSeat(seats, input.categoryId)
			? ('waitlist' as const)
			: event.priceAmountMinor > 0
				? ('pending_payment' as const)
				: ('registered' as const);
		const holdUntil =
			status === 'pending_payment'
				? new Date(now.getTime() + deps.settings.holdMinutes * 60_000)
				: null;
		const values = {
			categoryId: input.categoryId,
			status,
			holdUntil,
			registeredAt: sql`clock_timestamp()`
		};
		const [row] = existingId
			? await tx
					.update(eventRegistrations)
					.set({ ...values, ...CLEARED })
					.where(eq(eventRegistrations.id, existingId))
					.returning({ id: eventRegistrations.id })
			: await tx
					.insert(eventRegistrations)
					.values({ eventId: event.id, userId, ...values })
					.returning({ id: eventRegistrations.id });
		return { ok: true, id: row.id, status, holdUntil };
	});
}
