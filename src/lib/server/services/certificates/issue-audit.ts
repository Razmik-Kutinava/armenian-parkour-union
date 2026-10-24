import type { LimitDb } from '../../auth/rate-limit';
import type { users } from '../../db/schema/users';
import { writeAudit } from '../audit';
import type { Actor } from '../users/target';
import type { IssueValues } from './issue-input';
import type { CertificatePoints } from './issue-points';

/* docs/04 section 9 p. 6: the issue and the level change it brings, with who, before and after. */

type Level = (typeof users.$inferSelect)['level'];
type Context = { actor: Actor; ip: string | null; certificateId: string };

export async function logLevelChange(
	tx: LimitDb,
	c: Context,
	userId: string,
	before: Level,
	after: Level
) {
	await writeAudit(tx, {
		actorId: c.actor.id,
		action: 'user.level',
		entityType: 'user',
		entityId: userId,
		before: { level: before },
		after: { level: after, certificateId: c.certificateId },
		ip: c.ip
	});
}

export async function logIssue(
	tx: LimitDb,
	c: Context,
	v: IssueValues,
	facts: { number: string; levelBefore: Level; levelAfter: Level; points: CertificatePoints }
) {
	await writeAudit(tx, {
		actorId: c.actor.id,
		action: 'certificate.issue',
		entityType: 'certificate',
		entityId: c.certificateId,
		after: {
			userId: v.userId,
			kind: v.kind,
			level: v.level,
			category: v.category,
			number: facts.number,
			examId: v.examId,
			issuedAt: v.issuedAt.toISOString(),
			expiresAt: v.expiresAt?.toISOString() ?? null,
			comment: v.comment,
			levelBefore: facts.levelBefore,
			levelAfter: facts.levelAfter,
			points: facts.points.awarded ?? facts.points.skipped
		},
		ip: c.ip
	});
}
