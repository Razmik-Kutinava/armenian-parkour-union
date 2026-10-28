import { eq } from 'drizzle-orm';
import type { LimitDb } from '../../auth/rate-limit';
import { courses } from '../../db/schema/training';
import { quizAttempts } from '../../db/schema/training-progress';
import { users } from '../../db/schema/users';
import { isUuid } from '../users/target';
import { attemptColumns, typed } from './attempt-list';
import type { SnapshotQuestion } from './quiz-draw';
import { accessOf, attemptsOf, quizCourse } from './quiz-facts';
import { attemptsLeft } from './quiz-rules';

/* docs/05 section 27 "Attempts": the card — snapshot questions, the member's answer, the right one;
 * the limit from the course settings as of now. A running attempt shows no questions: staff do not
 * see the right answers while the member is still answering. Decisions — docs/todo.md 9.11 (4–6). */

const optionOf = (v: number | null | undefined, size: number) =>
	typeof v === 'number' && Number.isInteger(v) && v >= 0 && v < size ? v : null;

export async function attemptDetail(db: LimitDb, id: string, now = new Date()) {
	if (!isUuid(id)) return null;
	const [row] = await db
		.select({ ...attemptColumns, snapshot: quizAttempts.questions, answers: quizAttempts.answers })
		.from(quizAttempts)
		.innerJoin(courses, eq(courses.id, quizAttempts.courseId))
		.innerJoin(users, eq(users.id, quizAttempts.userId))
		.where(eq(quizAttempts.id, id));
	if (!row) return null;
	const { snapshot, answers, ...rest } = typed(row, now);
	const [course, access, attempts] = await Promise.all([
		quizCourse(db, row.courseId),
		accessOf(db, row.courseId, row.userId),
		attemptsOf(db, row.courseId, row.userId)
	]);
	if (!course) return null;
	const settings = course;
	const extra = access?.extraAttempts ?? 0;
	const facts = { settings, attempts, extraAttempts: extra, finished: false, membership: true };
	const questions =
		rest.result === 'running'
			? null
			: (snapshot as SnapshotQuestion[]).map((q, i) => ({
					text: q.text,
					options: q.options,
					answer: optionOf(answers?.[i], q.options.length),
					correct: q.correct_index
				}));
	return {
		...rest,
		endedAt: rest.submittedAt ?? rest.expiresAt,
		questions,
		limit: {
			used: settings.attemptsLimit - attemptsLeft(facts, now),
			limit: settings.attemptsLimit,
			periodDays: settings.attemptsPeriodDays,
			extra
		}
	};
}
export type AttemptCard = NonNullable<Awaited<ReturnType<typeof attemptDetail>>>;
