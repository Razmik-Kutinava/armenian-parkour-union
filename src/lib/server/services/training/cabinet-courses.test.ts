import { eq } from 'drizzle-orm';
import { afterAll, describe, expect, it } from 'vitest';
import type { LimitDb } from '../../auth/rate-limit';
import { exams } from '../../db/schema/certification';
import { courseAccess } from '../../db/schema/training-progress';
import { testDb, testDbUrl } from '../../db/test-db';
import { insertCertificate } from '../exams/test-support';
import { cabinetCourses } from './cabinet-courses';
import { insertSubmission, insertTask, YT } from './practice-test-support';
import { pastAttempt } from './quiz-test-support';
import { applicant, insertOpenCourse } from './test-support';

/* docs/06 section 5.11 "Course list"; decisions — docs/todo.md 9.4 (6), 9.8 (6). */

const DAY = 86_400_000;

type Status = 'pending' | 'approved' | 'rejected' | 'revoked';

async function access(tx: LimitDb, courseId: string, userId: string, status: Status) {
	const decided = status === 'pending' ? {} : { reviewedAt: new Date() };
	const note = status === 'rejected' || status === 'revoked' ? { reviewNote: 'Причина' } : {};
	const [row] = await tx
		.insert(courseAccess)
		.values({ courseId, userId, status, ...decided, ...note })
		.returning({ id: courseAccess.id });
	return row.id;
}

describe.skipIf(!testDbUrl)('training access: courses in the cabinet', () => {
	const { inRollback, close } = testDb();
	afterAll(close);

	it('only published courses; each with its state for this member', async () => {
		await inRollback(async (tx) => {
			const user = await applicant(tx);
			const draft = await insertOpenCourse(tx, { status: 'draft' });
			const fresh = await insertOpenCourse(tx);
			const states: Record<string, string> = {};
			for (const status of ['pending', 'approved', 'rejected', 'revoked'] as const) {
				const course = await insertOpenCourse(tx);
				await access(tx, course.id, user.id, status);
				states[course.id] = status;
			}
			const done = await insertOpenCourse(tx);
			const doneId = await access(tx, done.id, user.id, 'approved');
			const [exam] = await tx
				.insert(exams)
				.values({ userId: user.id, kind: 'trainer', result: 'passed', decidedAt: new Date() })
				.returning({ id: exams.id });
			await tx.update(courseAccess).set({ examId: exam.id }).where(eq(courseAccess.id, doneId));

			const list = await cabinetCourses(tx, user.id);
			const byId = new Map(list.map((c) => [c.id, c]));
			expect(byId.has(draft.id)).toBe(false);
			expect(byId.get(fresh.id)).toMatchObject({ state: 'can_apply', canApply: true });
			for (const [id, status] of Object.entries(states)) {
				expect(byId.get(id)?.state).toBe(status);
			}
			expect(byId.get(done.id)).toMatchObject({ state: 'finished', canApply: false });
			const rejected = [...byId.values()].find((c) => c.state === 'rejected');
			expect(rejected).toMatchObject({ reviewNote: 'Причина', canApply: true });
			const revoked = [...byId.values()].find((c) => c.state === 'revoked');
			expect(revoked).toMatchObject({ reviewNote: 'Причина', canApply: false });
		});
	});

	it('conditions not met: what is missing, no button — also after a refusal', async () => {
		await inRollback(async (tx) => {
			const user = await applicant(tx, { member: false, level: 'novice' });
			const course = await insertOpenCourse(tx);
			const refused = await insertOpenCourse(tx);
			await access(tx, refused.id, user.id, 'rejected');
			const byId = new Map((await cabinetCourses(tx, user.id)).map((c) => [c.id, c]));
			expect(byId.get(course.id)).toMatchObject({
				state: 'missing',
				missing: ['membership', 'level'],
				canApply: false
			});
			expect(byId.get(refused.id)).toMatchObject({
				state: 'rejected',
				missing: ['membership', 'level'],
				canApply: false
			});
		});
	});

	it('approved: the quiz (passed or the retake date) and accepted N of M visible tasks', async () => {
		await inRollback(async (tx) => {
			const user = await applicant(tx);
			const failing = await insertOpenCourse(tx);
			await access(tx, failing.id, user.id, 'approved');
			const startedAt = new Date(Date.now() - DAY);
			await pastAttempt(tx, failing.id, user.id, startedAt);
			const passing = await insertOpenCourse(tx);
			await access(tx, passing.id, user.id, 'approved');
			await pastAttempt(tx, passing.id, user.id, startedAt, { correctCount: 4, passed: true });
			const [first, second] = [await insertTask(tx, passing.id, 0), await insertTask(tx, passing.id, 1)];
			const hidden = await insertTask(tx, passing.id, 2, { hiddenAt: new Date() });
			const reviewed = { status: 'approved' as const, reviewedAt: new Date() };
			await insertSubmission(tx, first, user.id, reviewed);
			await insertSubmission(tx, second, user.id, { url: YT(2) });
			await insertSubmission(tx, hidden, user.id, { ...reviewed, url: YT(3) });
			const pending = await insertOpenCourse(tx);
			await access(tx, pending.id, user.id, 'pending');

			const byId = new Map((await cabinetCourses(tx, user.id)).map((c) => [c.id, c]));
			expect(byId.get(failing.id)?.progress).toEqual({
				quizPassed: false,
				retakeAt: new Date(startedAt.getTime() + 600_000 + 30 * DAY),
				accepted: 0,
				total: 0
			});
			expect(byId.get(passing.id)?.progress).toEqual({
				quizPassed: true,
				retakeAt: null,
				accepted: 1,
				total: 2
			});
			expect(byId.get(pending.id)?.progress).toBeNull();
		});
	});

	it('finished: the certificate link appears only with a live certificate', async () => {
		await inRollback(async (tx) => {
			const user = await applicant(tx);
			const course = await insertOpenCourse(tx);
			const id = await access(tx, course.id, user.id, 'approved');
			const [exam] = await tx
				.insert(exams)
				.values({ userId: user.id, kind: 'trainer', result: 'passed', decidedAt: new Date() })
				.returning({ id: exams.id });
			await tx.update(courseAccess).set({ examId: exam.id }).where(eq(courseAccess.id, id));
			const finished = async () =>
				(await cabinetCourses(tx, user.id)).find((c) => c.id === course.id);
			expect(await finished()).toMatchObject({ state: 'finished', certified: false });
			await insertCertificate(tx, {
				userId: user.id,
				kind: 'trainer',
				issuedBy: user.id,
				examId: exam.id
			});
			expect(await finished()).toMatchObject({ state: 'finished', certified: true });
		});
	});

	it('another member sees no state of this one', async () => {
		await inRollback(async (tx) => {
			const user = await applicant(tx);
			const other = await applicant(tx);
			const course = await insertOpenCourse(tx);
			await access(tx, course.id, user.id, 'approved');
			const mine = (await cabinetCourses(tx, other.id)).find((c) => c.id === course.id);
			expect(mine).toMatchObject({ state: 'can_apply', reviewNote: null });
		});
	});
});
