import type { LimitDb } from '../../auth/rate-limit';
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

export type { PointsAdminDeps, PointsAdminResult } from './support';
export type AdjustInput = { userId: string; delta: number; comment: string };

const INT_MAX = 2_147_483_647;

/** docs/03 section 6.3 p. 1, 3, 4: an admin adds (+) or takes (−) points with a comment. */
export async function adjustPoints(
	db: LimitDb,
	actor: Actor,
	input: AdjustInput,
	deps: PointsAdminDeps
): Promise<PointsAdminResult> {
	if (!canAdjust(actor)) return refuse('not_allowed');
	const comment = cleanComment(input.comment);
	const { delta } = input;
	if (!comment || !Number.isInteger(delta) || delta === 0 || Math.abs(delta) > INT_MAX) {
		return refuse('invalid');
	}
	if (!isUuid(input.userId)) return refuse('not_found');
	return db.transaction(async (tx): Promise<PointsAdminResult> => {
		const result = await appendEntry(tx, {
			userId: input.userId,
			delta,
			reason: 'manual',
			comment,
			createdBy: actor.id
		});
		if (result.status === 'no_user') return refuse('not_found');
		if (result.status !== 'ok') return refuse('insufficient_balance');
		await writeAudit(tx, {
			actorId: actor.id,
			action: 'points.adjust',
			entityType: 'user',
			entityId: input.userId,
			before: { balance: result.balanceBefore },
			after: { balance: result.balanceAfter, delta, entryId: result.entry.id, comment },
			ip: deps.ip
		});
		return { ok: true, entryId: result.entry.id, balance: result.balanceAfter };
	});
}
