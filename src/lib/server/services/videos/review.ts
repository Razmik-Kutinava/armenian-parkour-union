import { eq } from 'drizzle-orm';
import { roleCan } from '../../auth/permissions';
import type { LimitDb } from '../../auth/rate-limit';
import { users } from '../../db/schema/users';
import { videos } from '../../db/schema/videos';
import type { Mail } from '../../mail/resend';
import { writeAudit } from '../audit';
import { awardPoints } from '../points/award';
import { isUuid, type Actor } from '../users/target';
import { videoDecisionLetter } from './mail';

/* docs/05 section 11, docs/03 sections 8 and 14; decisions — docs/todo.md 7.2. Each video is decided
 * in its own transaction under its row lock: approve and reject only a pending one (not one's own),
 * hide only an approved one. Letters wait for the commit; a failed one does not undo the decision. */

export type ModerationInput =
	{ action: 'approve' } | { action: 'reject'; reason: string } | { action: 'hide' };
export type ModerationDeps = {
	send: (mail: Mail) => Promise<void>;
	siteUrl: string | undefined;
	ip: string | null;
	now?: Date;
};
export type ModerationResult =
	{ ok: true; done: number; skipped: number } | { ok: false; reason: 'not_allowed' | 'invalid' };

const SKIPPED = 'skipped' as const;
const REASON_MAX = 1000;

async function decideOne(
	db: LimitDb,
	actor: Actor,
	id: string,
	input: ModerationInput,
	deps: ModerationDeps,
	now: Date
): Promise<Mail | null | typeof SKIPPED> {
	return db.transaction(async (tx) => {
		const [row] = await tx
			.select({
				video: videos,
				user: {
					email: users.email,
					locale: users.locale,
					firstName: users.firstName,
					name: users.name,
					deletedAt: users.deletedAt
				}
			})
			.from(videos)
			.innerJoin(users, eq(users.id, videos.userId))
			.where(eq(videos.id, id))
			.for('update', { of: videos });
		if (!row || row.user.deletedAt) return SKIPPED;
		const { video } = row;
		const audit = (action: string, after: Record<string, unknown>) =>
			writeAudit(tx, {
				actorId: actor.id,
				action,
				entityType: 'user',
				entityId: video.userId,
				before: { videoId: id, status: video.status },
				after: { videoId: id, ...after },
				ip: deps.ip
			});

		if (input.action === 'hide') {
			if (video.status !== 'approved' || video.hiddenAt) return SKIPPED;
			await tx.update(videos).set({ hiddenAt: now }).where(eq(videos.id, id));
			await audit('video.hide', { status: 'approved', hiddenAt: now });
			return null;
		}
		if (video.status !== 'pending' || video.userId === actor.id) return SKIPPED;
		const reviewed = { reviewedBy: actor.id, reviewedAt: now };
		if (input.action === 'reject') {
			const reason = input.reason.trim();
			await tx
				.update(videos)
				.set({ status: 'rejected', rejectReason: reason, ...reviewed })
				.where(eq(videos.id, id));
			await audit('video.reject', { status: 'rejected', rejectReason: reason });
			const decision = { status: 'rejected' as const, reason };
			return videoDecisionLetter(row.user, video.title, decision, deps.siteUrl);
		}
		await tx
			.update(videos)
			.set({ status: 'approved', ...reviewed })
			.where(eq(videos.id, id));
		const award = await awardPoints(tx, {
			rule: 'video_approved',
			userId: video.userId,
			sourceId: id
		});
		const points = award.status === 'awarded' ? award.points : 0;
		await audit('video.approve', {
			status: 'approved',
			points,
			...(award.status === 'skipped' ? { pointsSkipped: award.reason } : {})
		});
		const decision = { status: 'approved' as const, points };
		return videoDecisionLetter(row.user, video.title, decision, deps.siteUrl);
	});
}

/** One action on the selected videos (a quick button — one id); repeated ids count once. */
export async function moderateVideos(
	db: LimitDb,
	actor: Actor,
	ids: string[],
	input: ModerationInput,
	deps: ModerationDeps
): Promise<ModerationResult> {
	if (!roleCan(actor.role, 'videos.moderate')) return { ok: false, reason: 'not_allowed' };
	if (input.action === 'reject') {
		const reason = input.reason.trim();
		if (!reason || reason.length > REASON_MAX) return { ok: false, reason: 'invalid' };
	}
	const now = deps.now ?? new Date();
	let done = 0;
	let skipped = 0;
	for (const id of new Set(ids)) {
		const outcome = isUuid(id) ? await decideOne(db, actor, id, input, deps, now) : SKIPPED;
		if (outcome === SKIPPED) {
			skipped += 1;
			continue;
		}
		done += 1;
		if (outcome) {
			await deps.send(outcome).catch((e) => console.warn(`video ${id}: letter not sent`, e));
		}
	}
	return { ok: true, done, skipped };
}
