import { afterAll, describe, expect, it } from 'vitest';
import type { LimitDb } from '../../auth/rate-limit';
import { courseAccess } from '../../db/schema/training-progress';
import { testDb, testDbUrl } from '../../db/test-db';
import { practiceDetail } from './practice-queue';
import { practicePage } from './practice-read';
import { insertSubmission, practiceCourse, YT } from './practice-test-support';
import { startAttempt } from './quiz-start';
import { saveAnswers, submitAttempt } from './quiz-submit';
import {
	attemptRow,
	insertBank,
	pastAttempt,
	quizCourse,
	quizDeps,
	rightAnswers
} from './quiz-test-support';
import { applicant, insertOpenCourse, staff } from './test-support';

/* docs/04 section 7, docs/06 section 5.11: a member reaches only own attempts and submissions of
 * the course in the address; a swapped id is "not found" and changes nothing. */

const notFound = { ok: false, reason: 'not_found' };

async function approve(tx: LimitDb, courseId: string, userId: string) {
	await tx
		.insert(courseAccess)
		.values({ courseId, userId, status: 'approved', reviewedAt: new Date() });
}

/** A running attempt and the answers that would pass it. */
async function running(tx: LimitDb, ctx: Awaited<ReturnType<typeof quizCourse>>) {
	const started = await startAttempt(tx, ctx.member, ctx.course.slug, quizDeps());
	if (!started.ok) throw new Error(started.reason);
	const answers = rightAnswers((await attemptRow(tx, started.id)).questions);
	return { id: started.id, answers };
}

const untouched = { answers: null, correctCount: null, passed: null, submittedAt: null };

describe.skipIf(!testDbUrl)('training: swapped ids of attempts and submissions', () => {
	const { inRollback, close } = testDb();
	afterAll(close);

	it('own attempt sent under another course of the member — not found, unchanged', async () => {
		await inRollback(async (tx) => {
			const ctx = await quizCourse(tx);
			const other = await insertOpenCourse(tx, { quizSize: 4, passCount: 3 });
			await insertBank(tx, other.id, [3, 3]);
			await approve(tx, other.id, ctx.member.id);
			const { id, answers } = await running(tx, ctx);
			const deps = quizDeps();
			expect(await saveAnswers(tx, ctx.member, other.slug, id, answers, deps)).toEqual(notFound);
			expect(await submitAttempt(tx, ctx.member, other.slug, id, answers, deps)).toEqual(notFound);
			expect(await attemptRow(tx, id)).toMatchObject(untouched);
		});
	});

	it('another member’s attempt of the same course — not found, its answers unchanged', async () => {
		await inRollback(async (tx) => {
			const ctx = await quizCourse(tx);
			const intruder = await applicant(tx);
			await approve(tx, ctx.course.id, intruder.id);
			const actor = { id: intruder.id, role: 'member' as const };
			const { id, answers } = await running(tx, ctx);
			const deps = quizDeps();
			expect(await saveAnswers(tx, actor, ctx.course.slug, id, answers, deps)).toEqual(notFound);
			expect(await submitAttempt(tx, actor, ctx.course.slug, id, answers, deps)).toEqual(notFound);
			expect(await attemptRow(tx, id)).toMatchObject(untouched);
		});
	});

	it('the practice page shows only the member’s own submissions', async () => {
		await inRollback(async (tx) => {
			const ctx = await practiceCourse(tx);
			const other = await applicant(tx);
			await approve(tx, ctx.course.id, other.id);
			await pastAttempt(tx, ctx.course.id, other.id, new Date(Date.now() - 86_400_000), {
				correctCount: 4,
				passed: true
			});
			const foreign = await insertSubmission(tx, ctx.tasks[0], other.id, { url: YT(8) });
			const own = await insertSubmission(tx, ctx.tasks[1], ctx.member.id, { url: YT(9) });
			const page = await practicePage(tx, ctx.member, ctx.course.slug);
			expect(page?.tasks.map((t) => t.history.map((h) => h.id))).toEqual([[], [own]]);
			const json = JSON.stringify(page);
			expect(json).not.toContain(foreign);
			expect(json).not.toContain(YT(8).slice(-11));
		});
	});

	it('the review card: an unknown or malformed id gives nothing', async () => {
		await inRollback(async (tx) => {
			const admin = await staff(tx);
			expect(await practiceDetail(tx, crypto.randomUUID(), admin.id)).toBeNull();
			expect(await practiceDetail(tx, 'not-an-id', admin.id)).toBeNull();
		});
	});
});
