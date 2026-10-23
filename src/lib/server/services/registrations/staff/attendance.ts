import { eq } from 'drizzle-orm';
import { roleCan } from '../../../auth/permissions';
import type { LimitDb } from '../../../auth/rate-limit';
import { eventRegistrations } from '../../../db/schema/registrations';
import { writeAudit } from '../../audit';
import type { Actor } from '../../users/target';
import { YEREVAN_OFFSET } from '../admission';
import { awardEventResult } from '../points';
import { lockRegistration, type RegistrationRef } from './lock';

/* docs/05 section 5 "Event day", docs/03 section 7.6: one tap — "came" or "did not come". "Came"
 * earns participation (and the place, if set) once per registration; "did not come" takes nothing
 * back — points already paid are fixed by hand, like a changed place (7.7). */

export type AttendanceResult =
	'ok' | 'not_found' | 'not_allowed' | 'wrong_status' | 'event_closed' | 'too_early';

const DAY = 24 * 3_600_000;
export const MARKABLE = ['registered', 'attended', 'no_show'];
export const RESULTS_OPEN = ['published', 'finished'];

/** Marks open at 00:00 of the event's calendar day in Yerevan, not earlier. */
export function marksOpen(startsAt: Date, now: Date) {
	const local = startsAt.getTime() + YEREVAN_OFFSET;
	return now.getTime() >= local - (local % DAY) - YEREVAN_OFFSET;
}

export async function markAttendance(
	db: LimitDb,
	actor: Actor,
	ref: RegistrationRef & { came: boolean },
	ip: string | null,
	now = new Date()
): Promise<AttendanceResult> {
	if (!roleCan(actor.role, 'registrations.manage')) return 'not_allowed';
	return db.transaction(async (tx) => {
		const locked = await lockRegistration(tx, ref);
		if (!locked) return 'not_found' as const;
		const { event, row } = locked;
		if (!RESULTS_OPEN.includes(event.status)) return 'event_closed' as const;
		if (!marksOpen(event.startsAt, now)) return 'too_early' as const;
		if (!MARKABLE.includes(row.status)) return 'wrong_status' as const;
		const status = ref.came ? ('attended' as const) : ('no_show' as const);
		if (row.status === status) return 'ok' as const;
		await tx
			.update(eventRegistrations)
			.set({ status, attendedAt: ref.came ? now : null })
			.where(eq(eventRegistrations.id, row.id));
		if (ref.came) await awardEventResult(tx, { ...row, status });
		await writeAudit(tx, {
			actorId: actor.id,
			action: 'registration.attendance',
			entityType: 'registration',
			entityId: row.id,
			before: { status: row.status },
			after: { status, eventId: event.id, userId: row.userId },
			ip
		});
		return 'ok' as const;
	});
}
