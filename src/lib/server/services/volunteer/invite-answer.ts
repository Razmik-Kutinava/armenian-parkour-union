import { and, eq, sql } from 'drizzle-orm';
import type { LimitDb } from '../../auth/rate-limit';
import { volunteerInvitations, volunteerRequests } from '../../db/schema/volunteer-requests';
import { isUuid } from '../users/target';
import { cardFacts, lockCardMember } from './card-facts';
import { cardValidity } from './card-rules';
import { volunteerCards } from '../../db/schema/volunteer-cards';

/* docs/03 section 19.5 p. 3: answer while respond_by and card valid; accept needs a free seat
 * (request row locked). Changing mind frees the seat. */

export type InviteAnswer = 'accepted' | 'declined';
export type AnswerResult =
	{ ok: true } | { ok: false; reason: 'not_found' | 'respond_by' | 'full' | 'card' | 'bad_state' };

export async function answerInvite(
	db: LimitDb,
	userId: string,
	invitationId: string,
	answer: InviteAnswer,
	now = new Date()
): Promise<AnswerResult> {
	if (!isUuid(invitationId) || !isUuid(userId)) return { ok: false, reason: 'not_found' };
	return db.transaction(async (tx) => {
		const [invite] = await tx
			.select({
				id: volunteerInvitations.id,
				requestId: volunteerInvitations.requestId,
				status: volunteerInvitations.status,
				userId: volunteerInvitations.userId
			})
			.from(volunteerInvitations)
			.where(
				and(eq(volunteerInvitations.id, invitationId), eq(volunteerInvitations.userId, userId))
			);
		if (!invite) return { ok: false, reason: 'not_found' as const };
		if (!['invited', 'accepted', 'declined'].includes(invite.status)) {
			return { ok: false, reason: 'bad_state' as const };
		}
		const [request] = await tx
			.select()
			.from(volunteerRequests)
			.where(eq(volunteerRequests.id, invite.requestId))
			.for('update');
		if (!request || request.status !== 'open') return { ok: false, reason: 'bad_state' as const };
		if (request.respondBy <= now) return { ok: false, reason: 'respond_by' as const };
		const member = await lockCardMember(tx, userId);
		if (!member) return { ok: false, reason: 'not_found' as const };
		const [card] = await tx
			.select({ status: volunteerCards.status })
			.from(volunteerCards)
			.where(eq(volunteerCards.userId, userId));
		if (!card) return { ok: false, reason: 'card' as const };
		const facts = await cardFacts(tx, userId, member, now);
		if (!cardValidity(card.status, facts, now).valid) return { ok: false, reason: 'card' as const };
		if (answer === 'accepted' && invite.status !== 'accepted') {
			const [{ taken }] = await tx
				.select({ taken: sql<number>`count(*)::int` })
				.from(volunteerInvitations)
				.where(
					and(
						eq(volunteerInvitations.requestId, invite.requestId),
						eq(volunteerInvitations.status, 'accepted')
					)
				);
			if (taken >= request.places) return { ok: false, reason: 'full' as const };
		}
		if (invite.status === answer) return { ok: true as const };
		await tx
			.update(volunteerInvitations)
			.set({ status: answer, answeredAt: now })
			.where(eq(volunteerInvitations.id, invitationId));
		return { ok: true as const };
	});
}
