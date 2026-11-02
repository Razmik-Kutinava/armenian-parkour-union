import { eq } from 'drizzle-orm';
import { roleCan } from '../../auth/permissions';
import type { LimitDb } from '../../auth/rate-limit';
import { perkRedemptions, volunteerCards } from '../../db/schema/volunteer-cards';
import { writeAudit } from '../audit';
import { isUuid, type Actor } from '../users/target';

/* docs/03 section 19.4 p. 5, 19.9 p. 1: a cashier mark is fixed by a reversal row; one mark —
 * one reversal; remaining uses of a single perk come back. */

export type ReversePerkInput = { redemptionId: string; comment: string };
export type ReversePerkRefusal =
	'not_allowed' | 'invalid' | 'not_found' | 'not_reversible' | 'already_reversed';
export type ReversePerkResult =
	{ ok: true; reversalId: string } | { ok: false; reason: ReversePerkRefusal };

const refuse = (reason: ReversePerkRefusal): ReversePerkResult => ({ ok: false, reason });

function cleanComment(comment: string): string | null {
	const trimmed = comment.trim();
	return trimmed ? trimmed.slice(0, 1000) : null;
}

export async function reversePerk(
	db: LimitDb,
	actor: Actor,
	input: ReversePerkInput,
	deps: { ip: string | null }
): Promise<ReversePerkResult> {
	if (!roleCan(actor.role, 'volunteer.manage')) return refuse('not_allowed');
	const comment = cleanComment(input.comment);
	if (!comment) return refuse('invalid');
	if (!isUuid(input.redemptionId)) return refuse('not_found');

	return db.transaction(async (tx): Promise<ReversePerkResult> => {
		/* Peek without a lock: lock order must match markPerk — card first (zone-notes). */
		const [peek] = await tx
			.select({
				id: perkRedemptions.id,
				cardId: perkRedemptions.cardId,
				perkId: perkRedemptions.perkId,
				partnerId: perkRedemptions.partnerId,
				cashierId: perkRedemptions.cashierId,
				reversalOfId: perkRedemptions.reversalOfId
			})
			.from(perkRedemptions)
			.where(eq(perkRedemptions.id, input.redemptionId));
		if (!peek) return refuse('not_found');
		if (peek.reversalOfId !== null || peek.cashierId === null) return refuse('not_reversible');

		const [card] = await tx
			.select({ id: volunteerCards.id })
			.from(volunteerCards)
			.where(eq(volunteerCards.id, peek.cardId))
			.for('update');
		if (!card) return refuse('not_found');

		const [original] = await tx
			.select()
			.from(perkRedemptions)
			.where(eq(perkRedemptions.id, peek.id))
			.for('update');
		if (!original) return refuse('not_found');
		if (original.reversalOfId !== null || original.cashierId === null)
			return refuse('not_reversible');

		const [existing] = await tx
			.select({ id: perkRedemptions.id })
			.from(perkRedemptions)
			.where(eq(perkRedemptions.reversalOfId, original.id));
		if (existing) return refuse('already_reversed');

		try {
			const [row] = await tx
				.insert(perkRedemptions)
				.values({
					cardId: original.cardId,
					perkId: original.perkId,
					partnerId: original.partnerId,
					cashierId: null,
					reversalOfId: original.id,
					comment,
					createdBy: actor.id
				})
				.returning({ id: perkRedemptions.id });
			await writeAudit(tx, {
				actorId: actor.id,
				action: 'perk_redemption.reverse',
				entityType: 'volunteer_card',
				entityId: original.cardId,
				before: { redemptionId: original.id },
				after: { reversalId: row.id, redemptionId: original.id, comment },
				ip: deps.ip
			});
			return { ok: true, reversalId: row.id };
		} catch (err) {
			if ((err as { code?: string }).code === '23505') return refuse('already_reversed');
			throw err;
		}
	});
}
