import { and, eq, isNull, lte } from 'drizzle-orm';
import type { LimitDb } from '../../auth/rate-limit';
import { courses } from '../../db/schema/training';
import { courseAccess, quizAttempts } from '../../db/schema/training-progress';
import { users } from '../../db/schema/users';
import { settleExpired, type QuizDeps } from './quiz-close';

/* docs/03 section 18.3 p. 2, 4: an attempt left past its time is closed by the saved answers with
 * the result letter even if the member never comes back. Only members whose portal is open
 * (`openPortal`); the rest are closed lazily once the portal opens again. Decisions — docs/todo.md 9.16. */

export type QuizDailySummary = { closed: number; failed: number };

async function abandoned(db: LimitDb, now: Date) {
	return db
		.selectDistinct({ courseId: quizAttempts.courseId, userId: quizAttempts.userId })
		.from(quizAttempts)
		.innerJoin(courses, eq(courses.id, quizAttempts.courseId))
		.innerJoin(
			courseAccess,
			and(
				eq(courseAccess.courseId, quizAttempts.courseId),
				eq(courseAccess.userId, quizAttempts.userId)
			)
		)
		.innerJoin(users, eq(users.id, quizAttempts.userId))
		.where(
			and(
				isNull(quizAttempts.passed),
				lte(quizAttempts.expiresAt, now),
				eq(courses.status, 'published'),
				eq(courseAccess.status, 'approved'),
				eq(users.status, 'active'),
				isNull(users.deletedAt)
			)
		);
}

/** Once a day (`POST /api/cron/training`); safe to run again. One failed member does not stop the rest. */
export async function runQuizDaily(db: LimitDb, deps: QuizDeps): Promise<QuizDailySummary> {
	const now = deps.now ?? new Date();
	const summary: QuizDailySummary = { closed: 0, failed: 0 };
	for (const { courseId, userId } of await abandoned(db, now)) {
		try {
			summary.closed += await settleExpired(db, courseId, userId, deps, now);
		} catch (e) {
			summary.failed += 1;
			console.error(`training daily: course ${courseId}, member ${userId}`, e);
		}
	}
	return summary;
}
