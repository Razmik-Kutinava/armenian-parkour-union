import { eq } from 'drizzle-orm';
import { roleCan } from '../../auth/permissions';
import type { LimitDb } from '../../auth/rate-limit';
import { volunteerInvitations, volunteerRequests } from '../../db/schema/volunteer-requests';
import type { Mail } from '../../mail/resend';
import { writeAudit } from '../audit';
import { awardPoints } from '../points/award';
import { YEREVAN_OFFSET } from '../registrations/admission';
import { isUuid, type Actor } from '../users/target';
import { bumpDeclineStreak, resetDeclineStreak } from './card-flag';
import { closeRequestInvites, type CloseMailDeps } from './invite-close';

/* docs/03 section 19.5 p. 5, 19.6–19.7 p. 1, 19.9: attendance after the request day starts;
 * attended awards once; no_show +2 once; finish open → finished. */

export type MarkKind = 'attended' | 'no_show' | 'excused';
export type MarkResult =
	'ok' | 'not_found' | 'not_allowed' | 'wrong_status' | 'too_early' | 'request_closed';

const MARKABLE = ['accepted', 'attended', 'no_show', 'excused'] as const;
const DAY = 24 * 3_600_000;

/** Marks open at 00:00 of the request's calendar day in Yerevan, not earlier. */
export function marksOpen(startsAt: Date, now: Date) {
	const local = startsAt.getTime() + YEREVAN_OFFSET;
	return now.getTime() >= local - (local % DAY) - YEREVAN_OFFSET;
}

export async function markInvite(
	db: LimitDb,
	actor: Actor,
	invitationId: string,
	kind: MarkKind,
	ip: string | null,
	now = new Date(),
	deps?: CloseMailDeps
): Promise<MarkResult> {
	if (!roleCan(actor.role, 'volunteer.manage')) return 'not_allowed';
	if (!isUuid(invitationId)) return 'not_found';
	const pending: Mail[] = [];
	const result = await db.transaction(async (tx) => {
		const [ref] = await tx
			.select({ requestId: volunteerInvitations.requestId })
			.from(volunteerInvitations)
			.where(eq(volunteerInvitations.id, invitationId));
		if (!ref) return 'not_found' as const;
		const [request] = await tx
			.select()
			.from(volunteerRequests)
			.where(eq(volunteerRequests.id, ref.requestId))
			.for('update');
		if (!request) return 'not_found' as const;
		const [invite] = await tx
			.select()
			.from(volunteerInvitations)
			.where(eq(volunteerInvitations.id, invitationId))
			.for('update');
		if (!invite) return 'not_found' as const;
		if (request.status !== 'open') return 'request_closed' as const;
		if (!marksOpen(request.startsAt, now)) return 'too_early' as const;
		if (!(MARKABLE as readonly string[]).includes(invite.status)) {
			return 'wrong_status' as const;
		}
		if (invite.status === kind) return 'ok' as const;
		const firstCount = invite.countedAt === null;
		const countedAt =
			kind === 'attended' || firstCount ? (invite.countedAt ?? now) : invite.countedAt;
		await tx
			.update(volunteerInvitations)
			.set({ status: kind, markedBy: actor.id, markedAt: now, countedAt })
			.where(eq(volunteerInvitations.id, invitationId));
		if (kind === 'attended') {
			await resetDeclineStreak(tx, invite.userId);
			await awardPoints(tx, {
				rule: 'volunteer_participation',
				userId: invite.userId,
				sourceId: invitationId
			});
		} else if (kind === 'no_show' && firstCount) {
			const letter = await bumpDeclineStreak(tx, invite.userId, 2, now, deps?.siteUrl);
			if (letter) pending.push(letter);
		}
		await writeAudit(tx, {
			actorId: actor.id,
			action: 'volunteer_invitation.mark',
			entityType: 'volunteer_invitation',
			entityId: invitationId,
			before: { status: invite.status },
			after: { status: kind, requestId: request.id, userId: invite.userId },
			ip
		});
		return 'ok' as const;
	});
	if (deps) {
		for (const letter of pending) {
			await deps.send(letter).catch((e) => console.warn('volunteer mark: letter', e));
		}
	}
	return result;
}

export async function finishRequest(
	db: LimitDb,
	actor: Actor,
	requestId: string,
	ip: string | null,
	now = new Date(),
	deps?: CloseMailDeps
): Promise<'ok' | 'not_found' | 'not_allowed' | 'bad_state'> {
	if (!roleCan(actor.role, 'volunteer.manage')) return 'not_allowed';
	if (!isUuid(requestId)) return 'not_found';
	await closeRequestInvites(db, requestId, now, deps);
	return db.transaction(async (tx) => {
		const [row] = await tx
			.select()
			.from(volunteerRequests)
			.where(eq(volunteerRequests.id, requestId))
			.for('update');
		if (!row) return 'not_found' as const;
		if (row.status !== 'open') return 'bad_state' as const;
		await tx
			.update(volunteerRequests)
			.set({ status: 'finished' })
			.where(eq(volunteerRequests.id, requestId));
		await writeAudit(tx, {
			actorId: actor.id,
			action: 'volunteer_request.finish',
			entityType: 'volunteer_request',
			entityId: requestId,
			before: { status: 'open' },
			after: { status: 'finished' },
			ip
		});
		return 'ok' as const;
	});
}
