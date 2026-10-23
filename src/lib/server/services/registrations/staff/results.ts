import { and, eq, inArray } from 'drizzle-orm';
import { resultRowsSchema } from '#lib/validation/registration-results.ts';
import { roleCan } from '../../../auth/permissions';
import type { LimitDb } from '../../../auth/rate-limit';
import { eventRegistrations } from '../../../db/schema/registrations';
import { writeAudit } from '../../audit';
import { lockEvent } from '../../events/checks';
import { isUuid, type Actor } from '../../users/target';
import { awardEventResult } from '../points';
import { RESULTS_OPEN } from './attendance';

/* docs/05 section 5 "Results": place and score of those who came, the whole table in one
 * transaction. A new place 1-3 earns its points once per registration (docs/03 7.7: a changed
 * place is fixed by hand). */

export type ResultsResult =
	'ok' | 'not_found' | 'not_allowed' | 'invalid' | 'wrong_status' | 'event_closed';

type RawRow = { registrationId: string; place: string; score: string };

export async function saveResults(
	db: LimitDb,
	actor: Actor,
	input: { eventId: string; rows: RawRow[] },
	ip: string | null
): Promise<ResultsResult> {
	if (!roleCan(actor.role, 'registrations.manage')) return 'not_allowed';
	const parsed = resultRowsSchema.safeParse(input.rows);
	if (!parsed.success) return 'invalid';
	const ids = parsed.data.map((r) => r.registrationId);
	if (new Set(ids).size !== ids.length) return 'invalid';
	if (!isUuid(input.eventId)) return 'not_found';
	return db.transaction(async (tx) => {
		const event = await lockEvent(tx, input.eventId);
		if (!event) return 'not_found' as const;
		if (!RESULTS_OPEN.includes(event.status)) return 'event_closed' as const;
		if (ids.length === 0) return 'ok' as const;
		const current = await tx
			.select({
				id: eventRegistrations.id,
				userId: eventRegistrations.userId,
				status: eventRegistrations.status,
				place: eventRegistrations.place,
				score: eventRegistrations.score
			})
			.from(eventRegistrations)
			.where(and(eq(eventRegistrations.eventId, event.id), inArray(eventRegistrations.id, ids)))
			.orderBy(eventRegistrations.id)
			.for('update');
		const byId = new Map(current.map((r) => [r.id, r]));
		if (ids.some((id) => byId.get(id)?.status !== 'attended')) return 'wrong_status' as const;
		for (const { registrationId, place, score } of parsed.data) {
			const before = byId.get(registrationId)!;
			if (before.place === place && before.score === score) continue;
			await tx
				.update(eventRegistrations)
				.set({ place, score })
				.where(eq(eventRegistrations.id, registrationId));
			if (place !== null && place !== before.place) {
				await awardEventResult(tx, { ...before, place });
			}
			await writeAudit(tx, {
				actorId: actor.id,
				action: 'registration.result',
				entityType: 'registration',
				entityId: registrationId,
				before: { place: before.place, score: before.score },
				after: { place, score, eventId: event.id, userId: before.userId },
				ip
			});
		}
		return 'ok' as const;
	});
}
