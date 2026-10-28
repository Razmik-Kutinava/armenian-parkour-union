import { eq } from 'drizzle-orm';
import { afterAll, describe, expect, it } from 'vitest';
import { courseAccess, quizAttempts } from '../../db/schema/training-progress';
import { testDb, testDbUrl } from '../../db/test-db';
import { insertTask } from './practice-test-support';
import { quizPage } from './quiz-read';
import { startAttempt } from './quiz-start';
import { saveAnswers, submitAttempt } from './quiz-submit';
import { attemptRow, quizCourse, quizDeps, rightAnswers, wrongAnswers } from './quiz-test-support';
import { applicant, mailbox, SITE } from './test-support';

/* docs/03 sections 18.3 p. 4–6, 18.6 p. 2; docs/06 section 5.11 "Quiz"; decisions — docs/todo.md 9.6. */

const DAY = 86_400_000;
describe.skipIf(!testDbUrl)('training quiz: answers and the result', () => {
	const { inRollback, close } = testDb();
	afterAll(close);

	async function running(tx: Parameters<Parameters<typeof inRollback>[0]>[0], now = new Date()) {
		const ctx = await quizCourse(tx);
		const started = await startAttempt(tx, ctx.member, ctx.course.slug, quizDeps(undefined, now));
		if (!started.ok) throw new Error(started.reason);
		const row = await attemptRow(tx, started.id);
		return { ...ctx, id: started.id, questions: row.questions };
	}

	it('all correct: passed, a letter with the score; a second submit counts once, no second letter', async () => {
		await inRollback(async (tx) => {
			const { course, member, user, id, questions } = await running(tx);
			await insertTask(tx, course.id);
			const mail = mailbox();
			const answers = rightAnswers(questions);
			const result = await submitAttempt(tx, member, course.slug, id, answers, quizDeps(mail.send));
			expect(result).toEqual({ ok: true, correct: 4, total: 4, passed: true, expired: false });
			expect(await attemptRow(tx, id)).toMatchObject({ correctCount: 4, passed: true, answers });
			expect(mail.sent).toHaveLength(1);
			expect(mail.sent[0].to).toBe(user.email);
			expect(mail.sent[0].text).toContain('4');
			expect(mail.sent[0].text).toContain(`${SITE}/ru/cabinet/training/${course.slug}/test`);
			const again = await submitAttempt(
				tx,
				member,
				course.slug,
				id,
				[0, 0, 0, 0],
				quizDeps(mail.send)
			);
			expect(again).toEqual({ ok: true, correct: 4, total: 4, passed: true, expired: false });
			expect(mail.sent).toHaveLength(1);
			const page = await quizPage(tx, member, course.slug, quizDeps());
			expect(page?.state).toEqual({ kind: 'passed' });
			expect(page?.last).toMatchObject({ correct: 4, total: 4, passed: true });
			expect(page?.history).toHaveLength(1);
		});
	});

	it('below the threshold: failed, the letter names the retake date', async () => {
		await inRollback(async (tx) => {
			const now = new Date();
			const { course, member, id, questions } = await running(tx, now);
			const mail = mailbox();
			const answers = rightAnswers(questions).map((a, i) => (i < 2 ? a : (a + 1) % 3));
			const result = await submitAttempt(
				tx,
				member,
				course.slug,
				id,
				answers,
				quizDeps(mail.send, now)
			);
			expect(result).toEqual({ ok: true, correct: 2, total: 4, passed: false, expired: false });
			const retake = new Date(now.getTime() + 30 * DAY);
			const day = retake.toLocaleDateString('ru', { dateStyle: 'long', timeZone: 'Asia/Yerevan' });
			expect(mail.sent[0].text).toContain(day);
			const page = await quizPage(tx, member, course.slug, quizDeps(undefined, now));
			expect(page?.state).toMatchObject({ kind: 'wait' });
		});
	});

	it('answers are saved on the way; junk becomes empty, empty is wrong', async () => {
		await inRollback(async (tx) => {
			const { course, member, id, questions } = await running(tx);
			const right = rightAnswers(questions);
			const saved = await saveAnswers(
				tx,
				member,
				course.slug,
				id,
				[right[0], '9', null, 'x', 5],
				quizDeps()
			);
			expect(saved).toEqual({ ok: true });
			expect((await attemptRow(tx, id)).answers).toEqual([right[0], null, null, null]);
			const page = await quizPage(tx, member, course.slug, quizDeps());
			expect(page?.running?.answers).toEqual([right[0], null, null, null]);
			const result = await submitAttempt(tx, member, course.slug, id, [right[0]], quizDeps());
			expect(result).toMatchObject({ correct: 1, passed: false });
		});
	});

	it('after the time: posted answers are refused, the saved ones count', async () => {
		await inRollback(async (tx) => {
			const start = new Date(Date.now() - 2 * 3_600_000);
			const { course, member, id, questions } = await running(tx, start);
			const right = rightAnswers(questions);
			await saveAnswers(
				tx,
				member,
				course.slug,
				id,
				[right[0], null, null, null],
				quizDeps(undefined, start)
			);
			const late = new Date();
			expect(
				await saveAnswers(tx, member, course.slug, id, right, quizDeps(undefined, late))
			).toEqual({
				ok: false,
				reason: 'expired'
			});
			const result = await submitAttempt(
				tx,
				member,
				course.slug,
				id,
				right,
				quizDeps(undefined, late)
			);
			expect(result).toEqual({ ok: true, correct: 1, total: 4, passed: false, expired: true });
			const row = await attemptRow(tx, id);
			expect(row.submittedAt).toEqual(row.expiresAt);
		});
	});

	it('an attempt left past its time is closed when the page opens, with a letter', async () => {
		await inRollback(async (tx) => {
			const start = new Date(Date.now() - 2 * 3_600_000);
			const { course, member, id } = await running(tx, start);
			const mail = mailbox();
			const page = await quizPage(tx, member, course.slug, quizDeps(mail.send));
			expect(page?.running).toBeNull();
			expect(page?.last).toMatchObject({ correct: 0, total: 4, passed: false });
			expect(page?.state).toMatchObject({ kind: 'wait' });
			expect((await attemptRow(tx, id)).passed).toBe(false);
			expect(mail.sent).toHaveLength(1);
		});
	});

	it('another member’s attempt id — not found for save and submit', async () => {
		await inRollback(async (tx) => {
			const { course, id, questions } = await running(tx);
			const other = await applicant(tx);
			await tx.insert(courseAccess).values({
				courseId: course.id,
				userId: other.id,
				status: 'approved',
				reviewedAt: new Date()
			});
			const intruder = { id: other.id, role: 'member' as const };
			const answers = wrongAnswers(questions);
			expect(await saveAnswers(tx, intruder, course.slug, id, answers, quizDeps())).toEqual({
				ok: false,
				reason: 'not_found'
			});
			expect(await submitAttempt(tx, intruder, course.slug, id, answers, quizDeps())).toEqual({
				ok: false,
				reason: 'not_found'
			});
			expect(await submitAttempt(tx, intruder, course.slug, 'nope', answers, quizDeps())).toEqual({
				ok: false,
				reason: 'not_found'
			});
			const [row] = await tx.select().from(quizAttempts).where(eq(quizAttempts.id, id));
			expect(row.passed).toBeNull();
		});
	});
});
