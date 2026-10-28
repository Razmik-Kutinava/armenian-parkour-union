import { afterAll, describe, expect, it } from 'vitest';
import type { LimitDb } from '../../auth/rate-limit';
import { testDb, testDbUrl } from '../../db/test-db';
import { cabinetCourses } from './cabinet-courses';
import { openPortal } from './portal-gate';
import { quizPage, quizStatus } from './quiz-read';
import { startAttempt } from './quiz-start';
import { submitAttempt } from './quiz-submit';
import { attemptRow, quizCourse, quizDeps, rightAnswers, wrongAnswers } from './quiz-test-support';
import { staff } from './test-support';

/* docs/03 section 18.3 p. 4, docs/02 section 11: the correct answers stay on the server — no state
 * of the quiz page, the portal block, the result of a submit or the cabinet list carries them. */

const SECRET = /correct_?index|question_?id/i;
const clean = (data: unknown) => expect(JSON.stringify(data)).not.toMatch(SECRET);

type Ctx = Awaited<ReturnType<typeof quizCourse>>;

/** The quiz page and the portal block of the member, both checked; the page is returned. */
async function views(tx: LimitDb, { course, member }: Ctx, now?: Date) {
	const page = await quizPage(tx, member, course.slug, quizDeps(undefined, now));
	clean(page);
	const gate = await openPortal(tx, member, course.slug);
	clean(await quizStatus(tx, gate!, member.id, quizDeps(undefined, now)));
	return page;
}

async function sent(tx: LimitDb, ctx: Ctx, pick: typeof rightAnswers) {
	const started = await startAttempt(tx, ctx.member, ctx.course.slug, quizDeps());
	if (!started.ok) throw new Error(started.reason);
	const { questions } = await attemptRow(tx, started.id);
	expect(JSON.stringify(questions)).toMatch(SECRET);
	clean(await views(tx, ctx));
	return submitAttempt(tx, ctx.member, ctx.course.slug, started.id, pick(questions), quizDeps());
}

describe.skipIf(!testDbUrl)('training quiz: the correct answers never leave the server', () => {
	const { inRollback, close } = testDb();
	afterAll(close);

	it('before, during and after a failed attempt: the page and the portal block', async () => {
		await inRollback(async (tx) => {
			const ctx = await quizCourse(tx);
			expect((await views(tx, ctx))?.state).toMatchObject({ kind: 'open' });
			const result = await sent(tx, ctx, wrongAnswers);
			expect(result).toMatchObject({ ok: true, passed: false });
			clean(result);
			expect((await views(tx, ctx))?.history).toHaveLength(1);
		});
	});

	it('after a passed attempt: the result is only the score, the page and the cabinet list', async () => {
		await inRollback(async (tx) => {
			const ctx = await quizCourse(tx);
			const result = await sent(tx, ctx, rightAnswers);
			expect(Object.keys(result).sort()).toEqual(['correct', 'expired', 'ok', 'passed', 'total']);
			expect((await views(tx, ctx))?.state).toMatchObject({ kind: 'finished' });
			const listed = (await cabinetCourses(tx, ctx.member.id)).find((c) => c.id === ctx.course.id);
			expect(listed).toBeDefined();
			clean(listed);
		});
	});

	it('an attempt closed by the clock when the page opens', async () => {
		await inRollback(async (tx) => {
			const ctx = await quizCourse(tx);
			const past = new Date(Date.now() - 2 * 3_600_000);
			const started = await startAttempt(
				tx,
				ctx.member,
				ctx.course.slug,
				quizDeps(undefined, past)
			);
			if (!started.ok) throw new Error(started.reason);
			const page = await views(tx, ctx);
			expect(page?.running).toBeNull();
			expect(page?.last).toMatchObject({ id: started.id, passed: false });
		});
	});

	it('the cabinet list during an attempt and the preview of an admin', async () => {
		await inRollback(async (tx) => {
			const ctx = await quizCourse(tx);
			const started = await startAttempt(tx, ctx.member, ctx.course.slug, quizDeps());
			if (!started.ok) throw new Error(started.reason);
			clean((await cabinetCourses(tx, ctx.member.id)).find((c) => c.id === ctx.course.id));
			const admin = await staff(tx);
			const preview = await quizPage(tx, admin, ctx.course.slug, quizDeps());
			expect(preview?.state).toEqual({ kind: 'preview' });
			clean(preview);
		});
	});
});
