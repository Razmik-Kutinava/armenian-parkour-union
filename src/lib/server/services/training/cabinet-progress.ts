import { and, inArray, ne } from 'drizzle-orm';
import type { LimitDb } from '../../auth/rate-limit';
import { certificates } from '../../db/schema/certification';
import { practiceTally } from './course-complete';
import { attemptsOf } from './quiz-facts';
import { quizState, type QuizSettings } from './quiz-rules';

/* docs/06 section 5.11 "Course list": an approved course shows the quiz (passed or the retake
 * date) and accepted N of M; a finished one links to the certificate once it is issued.
 * Decisions — docs/todo.md 9.8 (6). */

export type CourseProgress = {
	quizPassed: boolean;
	/** The quiz is paused till then; `null` — passed or may start now. */
	retakeAt: Date | null;
	accepted: number;
	total: number;
};

export async function courseProgress(
	db: LimitDb,
	course: QuizSettings & { id: string },
	userId: string,
	access: { extraAttempts: number },
	membership: boolean,
	now: Date
): Promise<CourseProgress> {
	const attempts = await attemptsOf(db, course.id, userId);
	const facts = {
		settings: course,
		attempts,
		extraAttempts: access.extraAttempts,
		finished: false,
		membership
	};
	const state = quizState(facts, now);
	const { accepted, total } = await practiceTally(db, course.id, userId);
	return {
		quizPassed: state.kind === 'passed',
		retakeAt: state.kind === 'wait' ? state.retakeAt : null,
		accepted,
		total
	};
}

/** Exams with a live certificate among `examIds`. */
export async function certifiedExams(db: LimitDb, examIds: string[]) {
	if (examIds.length === 0) return new Set<string>();
	const rows = await db
		.select({ examId: certificates.examId })
		.from(certificates)
		.where(and(inArray(certificates.examId, examIds), ne(certificates.status, 'revoked')));
	return new Set(rows.map((r) => r.examId));
}
