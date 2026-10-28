import { and, eq, isNull } from 'drizzle-orm';
import type { LimitDb } from '../../auth/rate-limit';
import { practiceTasks, quizAttempts } from '../../db/schema/training-progress';
import { isUuid } from '../users/target';

/* Reads of the practice (docs/03 section 18.4): the quiz gate and the visible task. */

/** docs/03 section 18.4 p. 1: practice opens after the passed quiz. */
export async function quizPassed(db: LimitDb, courseId: string, userId: string) {
	const [row] = await db
		.select({ id: quizAttempts.id })
		.from(quizAttempts)
		.where(
			and(
				eq(quizAttempts.courseId, courseId),
				eq(quizAttempts.userId, userId),
				eq(quizAttempts.passed, true)
			)
		)
		.limit(1);
	return Boolean(row);
}

/** A task of this course that members see. */
export async function visibleTask(db: LimitDb, courseId: string, taskId: string) {
	if (!isUuid(taskId)) return null;
	const [row] = await db
		.select({ id: practiceTasks.id })
		.from(practiceTasks)
		.where(
			and(
				eq(practiceTasks.id, taskId),
				eq(practiceTasks.courseId, courseId),
				isNull(practiceTasks.hiddenAt)
			)
		);
	return row ?? null;
}
