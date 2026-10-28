import { eq } from 'drizzle-orm';
import { afterAll, describe, expect, it } from 'vitest';
import { exams } from '../../db/schema/certification';
import { courseAccess } from '../../db/schema/training-progress';
import { insertUser, testDb, testDbUrl } from '../../db/test-db';
import { accessDetail } from './access-card';
import { insertSubmission, insertTask, practiceCourse } from './practice-test-support';
import { pastAttempt, quizCourse } from './quiz-test-support';

/* docs/05 section 27 "Requests": the member card in a request — quiz attempts, practice status by
 * task, the exam link when the course is finished. Decisions — docs/todo.md 9.12. */

const DAY = 86_400_000;
const ago = (days: number) => new Date(Date.now() - days * DAY);
const snapshot = [
	{
		question_id: 'q1',
		text: { ru: 'Вопрос' },
		options: [{ ru: 'А' }, { ru: 'Б' }],
		correct_index: 1
	}
];

describe.skipIf(!testDbUrl)('training access: the request card', () => {
	const { inRollback, close } = testDb();
	afterAll(close);

	it('the request, the member attempts in this course newest first, practice by visible task', async () => {
		await inRollback(async (tx) => {
			const { course, user, accessId, tasks } = await practiceCourse(tx);
			await tx
				.update(courseAccess)
				.set({ extraAttempts: 1, reviewNote: 'ок' })
				.where(eq(courseAccess.id, accessId));
			const failed = await pastAttempt(tx, course.id, user.id, ago(40), {
				questions: snapshot,
				answers: [0],
				isExtra: true
			});
			const running = await pastAttempt(tx, course.id, user.id, new Date(Date.now() - 60_000), {
				expiresAt: new Date(Date.now() + 3_000_000),
				submittedAt: null,
				passed: null,
				correctCount: null
			});
			const other = await quizCourse(tx);
			await pastAttempt(tx, other.course.id, user.id, ago(2));
			await pastAttempt(tx, course.id, other.user.id, ago(3));
			const third = await insertTask(tx, course.id, 2);
			const hidden = await insertTask(tx, course.id, 3, { hiddenAt: new Date() });
			await insertSubmission(tx, hidden, user.id, { status: 'approved', reviewedAt: new Date() });
			const returned = { status: 'rejected' as const, reviewNote: 'темно', reviewedAt: ago(5) };
			await insertSubmission(tx, tasks[0], user.id, { ...returned, createdAt: ago(6) });
			const accepted = await insertSubmission(tx, tasks[0], user.id, {
				status: 'approved',
				reviewedAt: ago(1),
				createdAt: ago(2)
			});
			const back = await insertSubmission(tx, tasks[1], user.id, {
				...returned,
				createdAt: ago(4)
			});

			const card = await accessDetail(tx, accessId);
			expect(card).toMatchObject({
				id: accessId,
				userId: user.id,
				name: `Test ${user.tag}`,
				courseId: course.id,
				status: 'approved',
				reviewNote: 'ок',
				extraAttempts: 1,
				examId: null
			});
			expect(card?.createdAt).toBeInstanceOf(Date);
			expect(card?.reviewedAt).toBeInstanceOf(Date);
			expect(card?.attempts.map((a) => a.id)).toEqual([running, card?.attempts[1].id, failed]);
			expect(card?.attempts.map((a) => a.result)).toEqual(['running', 'passed', 'failed']);
			expect(card?.attempts[2]).toMatchObject({ isExtra: true, correctCount: 1, total: 4 });
			expect(card?.practice).toMatchObject({ accepted: 1, total: 3 });
			expect(
				card?.practice.tasks.map((t) => [t.id, t.current?.id ?? null, t.current?.status, t.count])
			).toEqual([
				[tasks[0], accepted, 'approved', 2],
				[tasks[1], back, 'rejected', 1],
				[third, null, undefined, 0]
			]);
			expect(card?.practice.tasks[0].title).toEqual({ ru: 'Задание 0' });
			expect(JSON.stringify(card)).not.toMatch(/correct_?index|"questions"|"answers"/i);
		});
	});

	it('a finished course links its exam', async () => {
		await inRollback(async (tx) => {
			const { user, accessId } = await quizCourse(tx);
			const [exam] = await tx
				.insert(exams)
				.values({ userId: user.id, kind: 'trainer', result: 'passed', decidedAt: new Date() })
				.returning({ id: exams.id });
			await tx.update(courseAccess).set({ examId: exam.id }).where(eq(courseAccess.id, accessId));
			expect((await accessDetail(tx, accessId))?.examId).toBe(exam.id);
		});
	});

	it('a pending request: no attempts, tasks without submissions; a deleted member; unknown — null', async () => {
		await inRollback(async (tx) => {
			const { course } = await practiceCourse(tx, { passed: false });
			const gone = await insertUser(tx, { deletedAt: new Date() });
			const [row] = await tx
				.insert(courseAccess)
				.values({ courseId: course.id, userId: gone.id })
				.returning({ id: courseAccess.id });
			const card = await accessDetail(tx, row.id);
			expect(card).toMatchObject({
				status: 'pending',
				name: `Test ${gone.tag}`,
				reviewedAt: null,
				examId: null,
				attempts: []
			});
			expect(card?.practice).toMatchObject({ accepted: 0, total: 2 });
			expect(card?.practice.tasks.every((t) => t.current === null && t.count === 0)).toBe(true);
			expect(await accessDetail(tx, crypto.randomUUID())).toBeNull();
			expect(await accessDetail(tx, 'nope')).toBeNull();
		});
	});
});
