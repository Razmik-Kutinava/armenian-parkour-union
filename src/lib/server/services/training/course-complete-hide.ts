import { and, asc, eq, isNull } from 'drizzle-orm';
import type { LimitDb } from '../../auth/rate-limit';
import { courseAccess } from '../../db/schema/training-progress';
import type { Mail } from '../../mail/resend';
import { completeCourse, type CompleteDeps } from './course-complete';

/* docs/03 section 18.5: hiding a task may finish the course of members whose last unaccepted task
 * it was. Decisions — docs/todo.md 9.13 (2–4). */

/** Approved requests of the course without an exam, locked; take them before the task row — a
 * video submit holds its request and then the task key, the opposite order deadlocks. */
export async function lockOpenAccess(tx: LimitDb, courseId: string) {
	const rows = await tx
		.select({ userId: courseAccess.userId })
		.from(courseAccess)
		.where(
			and(
				eq(courseAccess.courseId, courseId),
				eq(courseAccess.status, 'approved'),
				isNull(courseAccess.examId)
			)
		)
		.orderBy(asc(courseAccess.id))
		.for('update');
	return rows.map((r) => r.userId);
}

/** After the task is hidden, in the same transaction; the letters of every finished course. */
export async function completeAfterHide(
	tx: LimitDb,
	courseId: string,
	userIds: string[],
	actorId: string,
	deps: CompleteDeps
): Promise<Mail[]> {
	const letters: Mail[] = [];
	for (const userId of userIds) {
		letters.push(...(await completeCourse(tx, courseId, userId, actorId, deps)));
	}
	return letters;
}
