import { eq } from 'drizzle-orm';
import type { LimitDb } from '../../auth/rate-limit';
import { practiceSubmissions, practiceTasks } from '../../db/schema/training-progress';
import { pastAttempt, quizCourse } from './quiz-test-support';

/* Test support only: a course with practice tasks and an approved member. */

export const YT = (n: number) => `https://www.youtube.com/watch?v=${String(n).padStart(11, 'p')}`;

export async function insertTask(
	tx: LimitDb,
	courseId: string,
	sortOrder = 0,
	extra: Partial<typeof practiceTasks.$inferInsert> = {}
) {
	const [row] = await tx
		.insert(practiceTasks)
		.values({
			courseId,
			title: { ru: `Задание ${sortOrder}` },
			description: { ru: '<p>Манки, конг</p>' },
			sortOrder,
			...extra
		})
		.returning({ id: practiceTasks.id });
	return row.id;
}

/** Two visible tasks; `passed` — the member has passed the quiz (practice is open). */
export async function practiceCourse(tx: LimitDb, { passed = true, locale = 'ru' } = {}) {
	const quiz = await quizCourse(tx, {}, locale);
	if (passed) {
		await pastAttempt(tx, quiz.course.id, quiz.user.id, new Date(Date.now() - 86_400_000), {
			correctCount: 4,
			passed: true
		});
	}
	const tasks = [await insertTask(tx, quiz.course.id, 0), await insertTask(tx, quiz.course.id, 1)];
	return { ...quiz, tasks };
}

/** A submission written straight into the table (no checks, no letter). */
export async function insertSubmission(
	tx: LimitDb,
	taskId: string,
	userId: string,
	extra: Partial<typeof practiceSubmissions.$inferInsert> = {}
) {
	const [row] = await tx
		.insert(practiceSubmissions)
		.values({ taskId, userId, url: YT(1), platform: 'youtube', ...extra })
		.returning({ id: practiceSubmissions.id });
	return row.id;
}

export const submissionsOf = (tx: LimitDb, taskId: string) =>
	tx
		.select()
		.from(practiceSubmissions)
		.where(eq(practiceSubmissions.taskId, taskId))
		.orderBy(practiceSubmissions.createdAt);

export const submissionRow = async (tx: LimitDb, id: string) =>
	(await tx.select().from(practiceSubmissions).where(eq(practiceSubmissions.id, id)))[0];
