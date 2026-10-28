import { eq } from 'drizzle-orm';
import { afterAll, describe, expect, it } from 'vitest';
import type { LimitDb } from '../../auth/rate-limit';
import { exams } from '../../db/schema/certification';
import { courseAccess, practiceTasks } from '../../db/schema/training-progress';
import { testDb, testDbUrl } from '../../db/test-db';
import { reviewPractice } from './practice-review';
import { insertSubmission, insertTask, practiceCourse, YT } from './practice-test-support';
import { quizPage } from './quiz-read';
import { startAttempt } from './quiz-start';
import { saveAnswers, submitAttempt } from './quiz-submit';
import { attemptRow, quizCourse, quizDeps, rightAnswers } from './quiz-test-support';
import { accessRow, auditOf, IP, mailbox, setFederationEmail, SITE, staff } from './test-support';

/* docs/03 sections 18.5–18.6: the course is finished by the last event (a passed quiz or an
 * accepted video) — one passed exam, audit, letters to the member and the admin; decisions —
 * docs/todo.md 9.8 (1–4). */

const FED = 'federation@parkour.test';
const approve = { action: 'approve' as const, comment: '' };
const reviewDeps = (send = mailbox().send) => ({ send, siteUrl: SITE, ip: IP });
const examsOf = (tx: LimitDb, userId: string) =>
	tx.select().from(exams).where(eq(exams.userId, userId));

async function examOf(tx: LimitDb, accessId: string) {
	const { examId } = await accessRow(tx, accessId);
	if (!examId) return null;
	return (await tx.select().from(exams).where(eq(exams.id, examId)))[0];
}

/** Both tasks with a submission: the first accepted earlier by `earlier`, the second pending. */
async function lastPending(tx: LimitDb, locale = 'ru') {
	const ctx = await practiceCourse(tx, { locale });
	const earlier = await staff(tx);
	await insertSubmission(tx, ctx.tasks[0], ctx.member.id, {
		status: 'approved',
		reviewedBy: earlier.id,
		reviewedAt: new Date(Date.now() - 60_000)
	});
	const last = await insertSubmission(tx, ctx.tasks[1], ctx.member.id, { url: YT(2) });
	return { ...ctx, earlier, last };
}

async function passQuiz(tx: LimitDb, wrong = 0, send = mailbox().send) {
	const ctx = await quizCourse(tx, {}, 'en');
	const started = await startAttempt(tx, ctx.member, ctx.course.slug, quizDeps());
	if (!started.ok) throw new Error(started.reason);
	const { questions } = await attemptRow(tx, started.id);
	const answers = rightAnswers(questions).map((a, i) => (i < wrong ? (a + 1) % 3 : a));
	const result = await submitAttempt(tx, ctx.member, ctx.course.slug, started.id, answers, {
		...quizDeps(send),
		ip: IP
	});
	return { ...ctx, result };
}

describe.skipIf(!testDbUrl)('training: course completion', () => {
	const { inRollback, close } = testDb();
	afterAll(close);

	it('the last task accepted: one passed exam, audit, letters to the member and the admin', async () => {
		await inRollback(async (tx) => {
			await setFederationEmail(tx, FED);
			const { course, user, member, accessId, last } = await lastPending(tx);
			const moderator = await staff(tx, 'moderator');
			const box = mailbox();
			expect(await reviewPractice(tx, moderator, last, approve, reviewDeps(box.send))).toEqual({
				ok: true
			});
			const exam = await examOf(tx, accessId);
			expect(exam).toMatchObject({
				userId: member.id,
				kind: 'trainer',
				result: 'passed',
				score: '100.00',
				examinerId: moderator.id,
				notes: 'Training portal: quiz 4/4, practice 2/2',
				eventId: null
			});
			expect(exam?.decidedAt).toBeInstanceOf(Date);
			expect(exam?.scheduledAt).toEqual(exam?.decidedAt);
			const entries = await auditOf(tx, 'exam', exam!.id);
			expect(entries).toHaveLength(1);
			expect(entries[0]).toMatchObject({
				action: 'exam.course_complete',
				actorId: moderator.id,
				ip: IP,
				after: {
					kind: 'trainer',
					score: '100.00',
					courseId: course.id,
					userId: member.id,
					examinerId: moderator.id
				}
			});
			expect(box.sent.map((m) => m.to)).toEqual([user.email, user.email, FED]);
			const [, done, admin] = box.sent;
			expect(done.subject).toMatch(/курс пройден/i);
			expect(done.text).toContain(`${SITE}/ru/cabinet/training`);
			expect(admin.subject).toMatch(/course completed/i);
			expect(admin.text).toContain(`${SITE}/admin/exams/${exam!.id}`);
			expect(admin.text).toContain(user.lastName);
		});
	});

	it('not every visible task accepted — no exam; a hidden task is not required', async () => {
		await inRollback(async (tx) => {
			const admin = await staff(tx);
			const open = await practiceCourse(tx);
			const first = await insertSubmission(tx, open.tasks[0], open.member.id);
			await reviewPractice(tx, admin, first, approve, reviewDeps());
			expect((await accessRow(tx, open.accessId)).examId).toBeNull();
			expect(await examsOf(tx, open.member.id)).toEqual([]);

			const hidden = await practiceCourse(tx);
			await tx
				.update(practiceTasks)
				.set({ hiddenAt: new Date() })
				.where(eq(practiceTasks.id, hidden.tasks[1]));
			const only = await insertSubmission(tx, hidden.tasks[0], hidden.member.id);
			await reviewPractice(tx, admin, only, approve, reviewDeps());
			expect(await examOf(tx, hidden.accessId)).toMatchObject({
				examinerId: admin.id,
				notes: 'Training portal: quiz 4/4, practice 1/1'
			});
		});
	});

	it('the quiz finishes a course without visible tasks: the member is the actor, no examiner', async () => {
		await inRollback(async (tx) => {
			await setFederationEmail(tx, null);
			const box = mailbox();
			const { user, member, accessId, result } = await passQuiz(tx, 1, box.send);
			expect(result).toMatchObject({ ok: true, correct: 3, passed: true });
			const exam = await examOf(tx, accessId);
			expect(exam).toMatchObject({
				result: 'passed',
				score: '75.00',
				examinerId: null,
				notes: 'Training portal: quiz 3/4, practice 0/0'
			});
			const [entry] = await auditOf(tx, 'exam', exam!.id);
			expect(entry).toMatchObject({ actorId: member.id, ip: IP });
			expect(box.sent.map((m) => m.to)).toEqual([user.email, user.email]);
			expect(box.sent[1].subject).toMatch(/course completed/i);
		});
	});

	it('the quiz alone does not finish a course with a task', async () => {
		await inRollback(async (tx) => {
			const ctx = await quizCourse(tx);
			await insertTask(tx, ctx.course.id);
			const started = await startAttempt(tx, ctx.member, ctx.course.slug, quizDeps());
			if (!started.ok) throw new Error(started.reason);
			const { questions } = await attemptRow(tx, started.id);
			const deps = quizDeps();
			await submitAttempt(tx, ctx.member, ctx.course.slug, started.id, rightAnswers(questions), deps);
			expect((await accessRow(tx, ctx.accessId)).examId).toBeNull();
		});
	});

	it('a passed attempt closed lazily past its time finishes the course too', async () => {
		await inRollback(async (tx) => {
			const start = new Date(Date.now() - 2 * 3_600_000);
			const ctx = await quizCourse(tx);
			const started = await startAttempt(tx, ctx.member, ctx.course.slug, quizDeps(undefined, start));
			if (!started.ok) throw new Error(started.reason);
			const { questions } = await attemptRow(tx, started.id);
			const deps = quizDeps(undefined, start);
			await saveAnswers(tx, ctx.member, ctx.course.slug, started.id, rightAnswers(questions), deps);
			const page = await quizPage(tx, ctx.member, ctx.course.slug, quizDeps());
			expect(page?.state).toEqual({ kind: 'finished' });
			const exam = await examOf(tx, ctx.accessId);
			expect(exam).toMatchObject({ result: 'passed', score: '100.00' });
			const [entry] = await auditOf(tx, 'exam', exam!.id);
			expect(entry).toMatchObject({ actorId: ctx.member.id, ip: null });
		});
	});

	it('closed access: accepting the last video does not finish the course', async () => {
		await inRollback(async (tx) => {
			const { member, accessId, last } = await lastPending(tx);
			await tx
				.update(courseAccess)
				.set({ status: 'revoked', reviewNote: 'Нарушение' })
				.where(eq(courseAccess.id, accessId));
			const admin = await staff(tx);
			expect(await reviewPractice(tx, admin, last, approve, reviewDeps())).toEqual({ ok: true });
			expect(await examsOf(tx, member.id)).toEqual([]);
		});
	});

	it('a finished course is never finished again', async () => {
		await inRollback(async (tx) => {
			const { member, accessId, last } = await lastPending(tx);
			const [exam] = await tx
				.insert(exams)
				.values({ userId: member.id, kind: 'trainer', result: 'passed', decidedAt: new Date() })
				.returning({ id: exams.id });
			await tx.update(courseAccess).set({ examId: exam.id }).where(eq(courseAccess.id, accessId));
			const admin = await staff(tx);
			const box = mailbox();
			await reviewPractice(tx, admin, last, approve, reviewDeps(box.send));
			expect(await examsOf(tx, member.id)).toHaveLength(1);
			expect((await accessRow(tx, accessId)).examId).toBe(exam.id);
			expect(box.sent).toHaveLength(1);
		});
	});

	it('no federation address — only the member is told; a failing mail keeps the exam', async () => {
		await inRollback(async (tx) => {
			await setFederationEmail(tx, null);
			const admin = await staff(tx);
			const told = await lastPending(tx, 'en');
			const box = mailbox();
			await reviewPractice(tx, admin, told.last, approve, reviewDeps(box.send));
			expect(box.sent.map((m) => m.to)).toEqual([told.user.email, told.user.email]);

			const down = await lastPending(tx);
			const result = await reviewPractice(tx, admin, down.last, approve, reviewDeps(mailbox(true).send));
			expect(result).toEqual({ ok: true });
			expect((await accessRow(tx, down.accessId)).examId).not.toBeNull();
		});
	});
});
