import { eq } from 'drizzle-orm';
import type { LimitDb } from '../../auth/rate-limit';
import { pointsLedger } from '../../db/schema/points';
import { writeAudit } from '../audit';
import { isUuid, type Actor } from '../users/target';
import { appendEntry } from './ledger';
import {
	canAdjust,
	cleanComment,
	refuse,
	type PointsAdminDeps,
	type PointsAdminResult
} from './support';

export type ReverseInput = { entryId: string; comment: string };

async function isReversed(tx: LimitDb, entryId: string) {
	const [row] = await tx
		.select({ id: pointsLedger.id })
		.from(pointsLedger)
		.where(eq(pointsLedger.reversalOfId, entryId));
	return !!row;
}

/**
 * docs/03 section 6.3 p. 2-4: a mistake is fixed by an entry of the opposite sign linked to the
 * original; one entry — one reversal (also the unique index under a race); the balance stays >= 0.
 */
export async function reverseEntry(
	db: LimitDb,
	actor: Actor,
	input: ReverseInput,
	deps: PointsAdminDeps
): Promise<PointsAdminResult> {
	if (!canAdjust(actor)) return refuse('not_allowed');
	const comment = cleanComment(input.comment);
	if (!comment) return refuse('invalid');
	if (!isUuid(input.entryId)) return refuse('not_found');
	return db.transaction(async (tx): Promise<PointsAdminResult> => {
		const [original] = await tx
			.select()
			.from(pointsLedger)
			.where(eq(pointsLedger.id, input.entryId));
		if (!original) return refuse('not_found');
		if (original.reason === 'reversal') return refuse('not_reversible');
		if (await isReversed(tx, original.id)) return refuse('already_reversed');
		const result = await appendEntry(tx, {
			userId: original.userId,
			delta: -original.delta,
			reason: 'reversal',
			sourceType: original.sourceType,
			sourceId: original.sourceId,
			comment,
			reversalOfId: original.id,
			createdBy: actor.id
		});
		if (result.status === 'duplicate') return refuse('already_reversed');
		if (result.status === 'no_user') return refuse('not_found');
		if (result.status !== 'ok') return refuse('insufficient_balance');
		await writeAudit(tx, {
			actorId: actor.id,
			action: 'points.reverse',
			entityType: 'user',
			entityId: original.userId,
			before: { balance: result.balanceBefore },
			after: {
				balance: result.balanceAfter,
				delta: result.entry.delta,
				entryId: result.entry.id,
				reversalOfId: original.id,
				comment
			},
			ip: deps.ip
		});
		return { ok: true, entryId: result.entry.id, balance: result.balanceAfter };
	});
}
