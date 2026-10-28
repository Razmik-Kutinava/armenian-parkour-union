import { eq } from 'drizzle-orm';
import { afterAll, describe, expect, it } from 'vitest';
import { memberships } from '../../db/schema/payments';
import { quizQuestions } from '../../db/schema/training';
import { courseAccess } from '../../db/schema/training-progress';
import { testDb, testDbUrl } from '../../db/test-db';
import { quizPage } from './quiz-read';
import { startAttempt } from './quiz-start';
import { attemptRow, pastAttempt, quizCourse, quizDeps } from './quiz-test-support';
import { accessRow, applicant, staff } from './test-support';

/* docs/03 section 18.3 p. 1–3; docs/06 section 5.11 "Quiz"; decisions — docs/todo.md 9.6. */

const DAY = 86_400_000;
describe.skipIf(!testDbUrl)('training quiz: start and the page', () => {
	const { inRollback, close } = testDb();
	afterAll(close);

	it('start: a snapshot of 4 questions, 2 per topic, threshold and time of the course', async () => {
		await inRollback(async (tx) => {
			const { course, member } = await quizCourse(tx);
			const now = new Date();
			const result = await startAttempt(tx, member, course.slug, quizDeps(undefined, now));
			expect(result).toMatchObject({ ok: true });
			if (!result.ok) return;
			const row = await attemptRow(tx, result.id);
			expect(row).toMatchObject({ userId: member.id, total: 4, passCount: 3, isExtra: false });
			expect(row.passed).toBeNull();
			expect(row.expiresAt.getTime() - row.startedAt.getTime()).toBe(60 * 60_000);
			expect(row.questions).toHaveLength(4);
			const ids = row.questions.map((q) => q.question_id);
			const topics = await tx
				.select({ id: quizQuestions.id, topicId: quizQuestions.topicId })
				.from(quizQuestions)
				.where(eq(quizQuestions.courseId, course.id));
			const per = new Map<string, number>();
			for (const t of topics.filter((q) => ids.includes(q.id)))
				per.set(t.topicId, (per.get(t.topicId) ?? 0) + 1);
			expect([...per.values()]).toEqual([2, 2]);
		});
	});

	it('the page during an attempt: questions and own answers, no correct answers anywhere', async () => {
		await inRollback(async (tx) => {
			const { course, member } = await quizCourse(tx);
			const started = await startAttempt(tx, member, course.slug, quizDeps());
			if (!started.ok) throw new Error(started.reason);
			const page = await quizPage(tx, member, course.slug, quizDeps());
			expect(page?.state).toEqual({ kind: 'running' });
			expect(page?.running?.id).toBe(started.id);
			expect(page?.running?.questions).toHaveLength(4);
			expect(Object.keys(page!.running!.questions[0]).sort()).toEqual(['options', 'text']);
			expect(page?.running?.secondsLeft).toBeGreaterThan(3590);
			expect(JSON.stringify(page)).not.toMatch(/correct_index|correctIndex|question_id/);
		});
	});

	it('before the first attempt: the rules, three attempts left', async () => {
		await inRollback(async (tx) => {
			const { course, member } = await quizCourse(tx);
			const page = await quizPage(tx, member, course.slug, quizDeps());
			expect(page).toMatchObject({
				preview: false,
				state: { kind: 'open', extra: false },
				rules: {
					size: 4,
					passCount: 3,
					minutes: 60,
					attemptsLimit: 3,
					attemptsLeft: 3,
					extraAttempts: 0
				},
				running: null,
				last: null,
				history: []
			});
		});
	});

	it('a second start while one is running — refused', async () => {
		await inRollback(async (tx) => {
			const { course, member } = await quizCourse(tx);
			await startAttempt(tx, member, course.slug, quizDeps());
			expect(await startAttempt(tx, member, course.slug, quizDeps())).toEqual({
				ok: false,
				reason: 'running'
			});
		});
	});

	it('preview of an admin: the page with the rules, start refused', async () => {
		await inRollback(async (tx) => {
			const { course } = await quizCourse(tx);
			const admin = await staff(tx);
			const page = await quizPage(tx, admin, course.slug, quizDeps());
			expect(page).toMatchObject({ preview: true, state: { kind: 'preview' } });
			expect(await startAttempt(tx, admin, course.slug, quizDeps())).toEqual({
				ok: false,
				reason: 'preview'
			});
		});
	});

	it('no approved request — no page and no start (404)', async () => {
		await inRollback(async (tx) => {
			const { course, accessId, member } = await quizCourse(tx);
			const other = await applicant(tx);
			const stranger = { id: other.id, role: 'member' as const };
			expect(await quizPage(tx, stranger, course.slug, quizDeps())).toBeNull();
			expect(await startAttempt(tx, stranger, course.slug, quizDeps())).toEqual({
				ok: false,
				reason: 'not_found'
			});
			await tx
				.update(courseAccess)
				.set({ status: 'revoked', reviewNote: 'Нарушение' })
				.where(eq(courseAccess.id, accessId));
			expect(await startAttempt(tx, member, course.slug, quizDeps())).toEqual({
				ok: false,
				reason: 'not_found'
			});
		});
	});

	it('a bank smaller than the quiz: start refused, the page says so', async () => {
		await inRollback(async (tx) => {
			const { course, member } = await quizCourse(tx, { quizSize: 7, passCount: 5 });
			expect(await startAttempt(tx, member, course.slug, quizDeps())).toEqual({
				ok: false,
				reason: 'bank'
			});
			expect((await quizPage(tx, member, course.slug, quizDeps()))?.state).toEqual({
				kind: 'bank'
			});
		});
	});

	it('membership required and expired — refused', async () => {
		await inRollback(async (tx) => {
			const { course, member } = await quizCourse(tx);
			await tx
				.update(memberships)
				.set({ status: 'expired' })
				.where(eq(memberships.userId, member.id));
			expect(await startAttempt(tx, member, course.slug, quizDeps())).toEqual({
				ok: false,
				reason: 'membership'
			});
		});
	});

	it('pause after a failed attempt and the limit; an extra attempt skips them and is used up', async () => {
		await inRollback(async (tx) => {
			const { course, member, accessId } = await quizCourse(tx);
			const now = new Date();
			await pastAttempt(tx, course.id, member.id, new Date(now.getTime() - 5 * DAY));
			const page = await quizPage(tx, member, course.slug, quizDeps(undefined, now));
			expect(page?.state).toMatchObject({ kind: 'wait' });
			expect(page?.rules.attemptsLeft).toBe(2);
			expect(await startAttempt(tx, member, course.slug, quizDeps(undefined, now))).toEqual({
				ok: false,
				reason: 'wait'
			});
			await tx.update(courseAccess).set({ extraAttempts: 1 }).where(eq(courseAccess.id, accessId));
			const result = await startAttempt(tx, member, course.slug, quizDeps(undefined, now));
			if (!result.ok) throw new Error(result.reason);
			expect((await attemptRow(tx, result.id)).isExtra).toBe(true);
			expect((await accessRow(tx, accessId)).extraAttempts).toBe(0);
		});
	});

	it('a passed test cannot be taken again', async () => {
		await inRollback(async (tx) => {
			const { course, member, accessId } = await quizCourse(tx);
			await pastAttempt(tx, course.id, member.id, new Date(Date.now() - 40 * DAY), {
				correctCount: 4,
				passed: true
			});
			await tx.update(courseAccess).set({ extraAttempts: 1 }).where(eq(courseAccess.id, accessId));
			expect(await startAttempt(tx, member, course.slug, quizDeps())).toEqual({
				ok: false,
				reason: 'passed'
			});
		});
	});
});
