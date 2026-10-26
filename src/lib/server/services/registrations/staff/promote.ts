import { eq } from 'drizzle-orm';
import { roleCan } from '../../../auth/permissions';
import type { LimitDb } from '../../../auth/rate-limit';
import { eventRegistrations } from '../../../db/schema/registrations';
import { writeAudit } from '../../audit';
import type { Actor } from '../../users/target';
import type { Refusal } from '../admission';
import type { CancelDeps } from '../cancel';
import { promotedLetter } from '../mail';
import { awardRegistration } from '../points';
import { hasSeat, readSeats } from '../seats';
import { sendLetters } from '../waitlist';
import { promotionRefusal } from '../waitlist-admission';
import { lockRegistration, type RegistrationRef } from './lock';

/* docs/05 section 5, docs/04 section 3: staff move a registration from the waitlist by hand. Only
 * onto a free seat (the limit is raised first) and only a member who would be admitted now
 * (docs/03 section 15); otherwise like the automatic move (docs/03 7.3): a paid event holds the
 * seat for `offer_hours`, a free one earns the registration points. */

export type PromoteResult =
	| 'ok'
	| 'not_found'
	| 'not_allowed'
	| 'wrong_status'
	| 'event_closed'
	| 'full'
	| 'user_not_found'
	| Refusal;

export async function promoteRegistration(
	db: LimitDb,
	actor: Actor,
	ref: RegistrationRef,
	deps: CancelDeps,
	ip: string | null,
	now = new Date()
): Promise<PromoteResult> {
	if (!roleCan(actor.role, 'registrations.manage')) return 'not_allowed';
	const outcome = await db.transaction(async (tx) => {
		const locked = await lockRegistration(tx, ref);
		if (!locked) return 'not_found' as const;
		const { event, row } = locked;
		if (event.status !== 'published') return 'event_closed' as const;
		if (row.status !== 'waitlist') return 'wrong_status' as const;
		const refusal = await promotionRefusal(tx, event, row, now);
		if (refusal) return refusal;
		const seats = await readSeats(tx, event.id, event.capacity);
		if (!hasSeat(seats, row.categoryId)) return 'full' as const;
		const paid = event.priceAmountMinor > 0;
		const holdUntil = paid ? new Date(now.getTime() + deps.settings.offerHours * 3_600_000) : null;
		const status = paid ? ('pending_payment' as const) : ('registered' as const);
		await tx
			.update(eventRegistrations)
			.set({ status, holdUntil })
			.where(eq(eventRegistrations.id, row.id));
		if (!paid) await awardRegistration(tx, row);
		await writeAudit(tx, {
			actorId: actor.id,
			action: 'registration.promote',
			entityType: 'registration',
			entityId: row.id,
			before: { status: row.status },
			after: { status, eventId: event.id, userId: row.userId, holdUntil },
			ip
		});
		return [promotedLetter(row.user, event, holdUntil, deps.siteUrl)];
	});
	if (typeof outcome === 'string') return outcome;
	await sendLetters(deps.send, outcome);
	return 'ok';
}
