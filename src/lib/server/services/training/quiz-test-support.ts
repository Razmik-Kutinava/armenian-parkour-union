import { eq } from 'drizzle-orm';
import type { LimitDb } from '../../auth/rate-limit';
import { courses, quizQuestions } from '../../db/schema/training';
import { courseAccess, quizAttempts } from '../../db/schema/training-progress';
import type { SnapshotQuestion } from './quiz-draw';
import { applicant, insertOpenCourse, insertTopic, mailbox, SITE } from './test-support';

/* Test support only: a course with a small quiz bank and an approved member. */

/** Topics × questions; three options each, the correct one at `i % 3`. */
export async function insertBank(tx: LimitDb, courseId: string, perTopic: number[]) {
	for (const [t, count] of perTopic.entries()) {
		const topicId = await insertTopic(tx, courseId, t);
		for (let i = 0; i < count; i++) {
			await tx.insert(quizQuestions).values({
				courseId,
				topicId,
				text: { ru: `Вопрос ${t}.${i}` },
				options: [{ ru: 'А' }, { ru: 'Б' }, { ru: 'В' }],
				correctIndex: i % 3
			});
		}
	}
}

type CourseExtra = Partial<typeof courses.$inferInsert>;

/** Quiz of 4 from 2 topics × 3, 3 to pass, 60 minutes, 30 days pause, 3 per 180 days. */
export async function quizCourse(tx: LimitDb, extra: CourseExtra = {}, locale = 'ru') {
	const course = await insertOpenCourse(tx, { quizSize: 4, passCount: 3, ...extra });
	await insertBank(tx, course.id, [3, 3]);
	const user = await applicant(tx, { locale });
	const [access] = await tx
		.insert(courseAccess)
		.values({ courseId: course.id, userId: user.id, status: 'approved', reviewedAt: new Date() })
		.returning({ id: courseAccess.id });
	return { course, user, member: { id: user.id, role: 'member' as const }, accessId: access.id };
}

export const quizDeps = (send = mailbox().send, now?: Date) => ({ send, siteUrl: SITE, now });

export async function attemptRow(tx: LimitDb, id: string) {
	const [row] = await tx.select().from(quizAttempts).where(eq(quizAttempts.id, id));
	return { ...row, questions: row.questions as SnapshotQuestion[] };
}

export const rightAnswers = (questions: SnapshotQuestion[]) =>
	questions.map((q) => q.correct_index);
export const wrongAnswers = (questions: SnapshotQuestion[]) =>
	questions.map((q) => (q.correct_index + 1) % q.options.length);

/** A finished attempt in the past, outside the services (no draw, no letter). */
export async function pastAttempt(
	tx: LimitDb,
	courseId: string,
	userId: string,
	startedAt: Date,
	extra: Partial<typeof quizAttempts.$inferInsert> = {}
) {
	const [row] = await tx
		.insert(quizAttempts)
		.values({
			courseId,
			userId,
			questions: [],
			total: 4,
			passCount: 3,
			correctCount: 1,
			passed: false,
			startedAt,
			expiresAt: new Date(startedAt.getTime() + 3_600_000),
			submittedAt: new Date(startedAt.getTime() + 600_000),
			...extra
		})
		.returning({ id: quizAttempts.id });
	return row.id;
}
