import { and, asc, count, desc, eq, isNull } from 'drizzle-orm';
import type { PortalText } from '#lib/i18n/localized.ts';
import type { LimitDb } from '../../auth/rate-limit';
import { courses, courseTopics, quizQuestions } from '../../db/schema/training';
import { courseAccess, quizAttempts } from '../../db/schema/training-progress';
import { getMembershipOverview } from '../memberships/overview';
import type { BankQuestion } from './quiz-draw';
import type { QuizFacts } from './quiz-rules';

/* Reads of the quiz (docs/03 section 18.3): settings, the bank, the member's attempts. */

export async function quizCourse(db: LimitDb, courseId: string) {
	const [row] = await db.select().from(courses).where(eq(courses.id, courseId));
	return row ?? null;
}
export type QuizCourse = NonNullable<Awaited<ReturnType<typeof quizCourse>>>;

export async function accessOf(db: LimitDb, courseId: string, userId: string, lock = false) {
	const query = db
		.select()
		.from(courseAccess)
		.where(and(eq(courseAccess.courseId, courseId), eq(courseAccess.userId, userId)));
	const [row] = lock ? await query.for('update') : await query;
	return row ?? null;
}

/** Newest first. */
export const attemptsOf = (db: LimitDb, courseId: string, userId: string) =>
	db
		.select()
		.from(quizAttempts)
		.where(and(eq(quizAttempts.courseId, courseId), eq(quizAttempts.userId, userId)))
		.orderBy(desc(quizAttempts.startedAt));
export type AttemptRow = Awaited<ReturnType<typeof attemptsOf>>[number];

const visibleQuestions = (courseId: string) =>
	and(
		eq(quizQuestions.courseId, courseId),
		isNull(quizQuestions.hiddenAt),
		isNull(courseTopics.hiddenAt)
	);

export async function quizBank(db: LimitDb, courseId: string) {
	const rows = await db
		.select({
			id: quizQuestions.id,
			topicId: quizQuestions.topicId,
			text: quizQuestions.text,
			options: quizQuestions.options,
			correctIndex: quizQuestions.correctIndex
		})
		.from(quizQuestions)
		.innerJoin(courseTopics, eq(courseTopics.id, quizQuestions.topicId))
		.where(visibleQuestions(courseId))
		.orderBy(asc(courseTopics.sortOrder), asc(courseTopics.id), asc(quizQuestions.createdAt));
	const bank = rows.map((r) => ({
		...r,
		text: r.text as PortalText,
		options: r.options as PortalText[]
	})) satisfies BankQuestion[];
	return { bank, topicOrder: [...new Set(bank.map((q) => q.topicId))] };
}

export async function bankSize(db: LimitDb, courseId: string) {
	const [{ n }] = await db
		.select({ n: count() })
		.from(quizQuestions)
		.innerJoin(courseTopics, eq(courseTopics.id, quizQuestions.topicId))
		.where(visibleQuestions(courseId));
	return n;
}

export async function quizFacts(
	db: LimitDb,
	course: QuizCourse,
	access: { extraAttempts: number; examId: string | null },
	attempts: AttemptRow[],
	userId: string,
	now: Date
): Promise<QuizFacts> {
	const membership = course.requiresMembership
		? (await getMembershipOverview(db, userId, now)).active
		: true;
	return {
		settings: course,
		attempts,
		extraAttempts: access.extraAttempts,
		finished: access.examId !== null,
		membership
	};
}
