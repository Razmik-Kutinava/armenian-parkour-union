import { eq } from 'drizzle-orm';
import { afterAll, describe, expect, it } from 'vitest';
import type { LimitDb } from '../../auth/rate-limit';
import { exams } from '../../db/schema/certification';
import { courseAccess } from '../../db/schema/training-progress';
import { testDb, testDbUrl } from '../../db/test-db';
import { cabinetCourses } from './cabinet-courses';
import { applicant, insertOpenCourse } from './test-support';

/* docs/06 section 5.11 "Course list"; decisions — docs/todo.md 9.4 (6). */

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
			await tx
				.update(courseAccess)
				.set({ examId: exam.id })
				.where(eq(courseAccess.id, doneId));

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
