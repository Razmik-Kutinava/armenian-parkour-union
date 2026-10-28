import { and, eq } from 'drizzle-orm';
import { roleCan } from '../../auth/permissions';
import type { LimitDb } from '../../auth/rate-limit';
import { courseAccess, quizAttempts } from '../../db/schema/training-progress';
import { writeAudit } from '../audit';
import { isUuid, type Actor } from '../users/target';

/* docs/03 sections 18.3 p. 1 and 18.6 p. 1, docs/05 section 27 "Requests": an admin grants one more
 * attempt out of the pause and the limit — only while the test can still be taken. Row lock, audit
 * in the same transaction; no letter. Decisions — docs/todo.md 9.6 (8). */

export type ExtraResult =
	{ ok: true } | { ok: false; reason: 'not_allowed' | 'not_found' | 'bad_state' };

const refuse = (reason: 'not_allowed' | 'not_found' | 'bad_state') =>
	({ ok: false, reason }) as const;

export async function grantExtraAttempt(
	db: LimitDb,
	actor: Actor,
	accessId: string,
	deps: { ip: string | null }
): Promise<ExtraResult> {
	if (!roleCan(actor.role, 'training.manage')) return refuse('not_allowed');
	if (!isUuid(accessId)) return refuse('not_found');
	return db.transaction(async (tx): Promise<ExtraResult> => {
		const [row] = await tx
			.select()
			.from(courseAccess)
			.where(eq(courseAccess.id, accessId))
			.for('update');
		if (!row) return refuse('not_found');
		if (row.status !== 'approved' || row.examId !== null) return refuse('bad_state');
		const [passed] = await tx
			.select({ id: quizAttempts.id })
			.from(quizAttempts)
			.where(
				and(
					eq(quizAttempts.courseId, row.courseId),
					eq(quizAttempts.userId, row.userId),
					eq(quizAttempts.passed, true)
				)
			)
			.limit(1);
		if (passed) return refuse('bad_state');
		const extraAttempts = row.extraAttempts + 1;
		await tx.update(courseAccess).set({ extraAttempts }).where(eq(courseAccess.id, row.id));
		await writeAudit(tx, {
			actorId: actor.id,
			action: 'course_access.extra_attempt',
			entityType: 'course_access',
			entityId: row.id,
			before: { extraAttempts: row.extraAttempts },
			after: { extraAttempts, courseId: row.courseId, userId: row.userId },
			ip: deps.ip
		});
		return { ok: true };
	});
}
