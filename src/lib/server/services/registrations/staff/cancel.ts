import { eq } from 'drizzle-orm';
import { cancelReasonSchema } from '#lib/validation/events.ts';
import { roleCan } from '../../../auth/permissions';
import type { LimitDb } from '../../../auth/rate-limit';
import { eventRegistrations } from '../../../db/schema/registrations';
import { writeAudit } from '../../audit';
import type { Actor } from '../../users/target';
import { CANCELLABLE, type CancelDeps } from '../cancel';
import { staffCancelledLetter } from '../cancel-mail';
import { takeBackRegistration } from '../points';
import { holdsSeat } from '../seats';
import { settleCancelledPayment } from '../settle-cancel';
import { fillFromWaitlist, sendLetters } from '../waitlist';
import { lockRegistration, type RegistrationRef } from './lock';

/* docs/05 section 5: staff cancel a registration with a reason, without the member's deadline.
 * The rest as on the member's own cancel: points back before the start (docs/03 6.2 p. 6), the
 * seat to the waitlist, the payment settled after the commit (a paid one — the admin's review).
 * The member is told too (owner's answer 2026-10-26), without the staff reason. */

export type StaffCancelResult =
	'ok' | 'not_found' | 'not_allowed' | 'no_reason' | 'wrong_status' | 'event_closed';

const CLOSED = ['finished', 'cancelled', 'archived'];

export async function cancelRegistrationByStaff(
	db: LimitDb,
	actor: Actor,
	ref: RegistrationRef & { reason: string },
	deps: CancelDeps,
	ip: string | null,
	now = new Date()
): Promise<StaffCancelResult> {
	if (!roleCan(actor.role, 'registrations.manage')) return 'not_allowed';
	const reason = cancelReasonSchema.safeParse(ref.reason);
	if (!reason.success) return 'no_reason';
	const outcome = await db.transaction(async (tx) => {
		const locked = await lockRegistration(tx, ref);
		if (!locked) return 'not_found' as const;
		const { event, row } = locked;
		if (CLOSED.includes(event.status)) return 'event_closed' as const;
		if (!CANCELLABLE.includes(row.status)) return 'wrong_status' as const;
		const seat = holdsSeat(row.status);
		await tx
			.update(eventRegistrations)
			.set({ status: 'cancelled', holdUntil: null })
			.where(eq(eventRegistrations.id, row.id));
		if (seat) await takeBackRegistration(tx, row, event, now);
		await writeAudit(tx, {
			actorId: actor.id,
			action: 'registration.cancel',
			entityType: 'registration',
			entityId: row.id,
			before: { status: row.status },
			after: { status: 'cancelled', reason: reason.data, eventId: event.id, userId: row.userId },
			ip
		});
		const paid = row.status === 'registered' && row.paymentId !== null;
		const own = staffCancelledLetter(row.user, event, paid, deps.siteUrl);
		const queue = seat ? await fillFromWaitlist(tx, event.id, deps, now) : [];
		const letters = [own, ...queue];
		return { letters, paymentId: seat ? row.paymentId : null, id: row.id, eventId: event.id };
	});
	if (typeof outcome === 'string') return outcome;
	if (outcome.paymentId) {
		const { paymentId, id, eventId } = outcome;
		await settleCancelledPayment(db, paymentId, { id, eventId }, 'cancelled_by_staff').catch((e) =>
			console.error(`registration ${id}: payment ${paymentId} not settled`, e)
		);
	}
	await sendLetters(deps.send, outcome.letters);
	return 'ok';
}
