import { eq } from 'drizzle-orm';
import { afterAll, describe, expect, it } from 'vitest';
import type { LimitDb } from '../../auth/rate-limit';
import { courses } from '../../db/schema/training';
import { courseAccess, quizAttempts } from '../../db/schema/training-progress';
import { users } from '../../db/schema/users';
import { testDb, testDbUrl } from '../../db/test-db';
import { runQuizDaily } from './quiz-daily';
import { startAttempt } from './quiz-start';
import { attemptRow, quizCourse, quizDeps, rightAnswers } from './quiz-test-support';
import { accessRow, mailbox } from './test-support';

/* docs/03 section 18.3 p. 2, 4, section 18.6 p. 2; decision (9) 2026-10-28 — docs/todo.md 9.16.
 * The dev database is shared: only own rows and letters are checked, the counter — at least. */

const HOUR = 3_600_000;
describe.skipIf(!testDbUrl)('training quiz: the daily close of abandoned attempts', () => {
	const { inRollback, close } = testDb();
	afterAll(close);

	async function attempt(tx: LimitDb, startedAt = new Date(Date.now() - 2 * HOUR)) {
		const ctx = await quizCourse(tx);
		const started = await startAttempt(
			tx,
			ctx.member,
			ctx.course.slug,
			quizDeps(undefined, startedAt)
		);
		if (!started.ok) throw new Error(started.reason);
		return { ...ctx, id: started.id };
	}
	const to = (sent: { to: string }[], email: string) => sent.filter((m) => m.to === email);

	it('closes abandoned attempts by the saved answers, a letter to each; a repeat — nothing', async () => {
		await inRollback(async (tx) => {
			const right = await attempt(tx);
			const { questions } = await attemptRow(tx, right.id);
			await tx
				.update(quizAttempts)
				.set({ answers: rightAnswers(questions) })
				.where(eq(quizAttempts.id, right.id));
			const empty = await attempt(tx);
			const mail = mailbox();
			const summary = await runQuizDaily(tx, quizDeps(mail.send));
			expect(summary.closed).toBeGreaterThanOrEqual(2);
			expect(summary.failed).toBe(0);

			const passed = await attemptRow(tx, right.id);
			expect(passed).toMatchObject({ passed: true, correctCount: 4 });
			expect(passed.submittedAt).toEqual(passed.expiresAt);
			expect((await accessRow(tx, right.accessId)).examId).not.toBeNull();
			expect(to(mail.sent, right.user.email).length).toBeGreaterThanOrEqual(1);

			const failed = await attemptRow(tx, empty.id);
			expect(failed).toMatchObject({ passed: false, correctCount: 0 });
			expect(failed.submittedAt).toEqual(failed.expiresAt);
			expect(to(mail.sent, empty.user.email)).toHaveLength(1);

			const again = mailbox();
			expect(await runQuizDaily(tx, quizDeps(again.send))).toEqual({ closed: 0, failed: 0 });
			expect(again.sent).toHaveLength(0);
		});
	}, 60_000);

	it('leaves an attempt in time and members whose portal is closed', async () => {
		await inRollback(async (tx) => {
			const inTime = await attempt(tx, new Date());
			const revoked = await attempt(tx);
			await tx
				.update(courseAccess)
				.set({ status: 'revoked', reviewNote: 'Closed' })
				.where(eq(courseAccess.id, revoked.accessId));
			const blocked = await attempt(tx);
			await tx.update(users).set({ status: 'blocked' }).where(eq(users.id, blocked.user.id));
			const deleted = await attempt(tx);
			await tx.update(users).set({ deletedAt: new Date() }).where(eq(users.id, deleted.user.id));
			const draft = await attempt(tx);
			await tx.update(courses).set({ status: 'draft' }).where(eq(courses.id, draft.course.id));

			const mail = mailbox();
			await runQuizDaily(tx, quizDeps(mail.send));
			for (const left of [inTime, revoked, blocked, deleted, draft]) {
				expect((await attemptRow(tx, left.id)).passed).toBeNull();
				expect(to(mail.sent, left.user.email)).toHaveLength(0);
			}
		});
	}, 60_000);
});
