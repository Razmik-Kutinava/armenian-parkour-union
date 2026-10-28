import { eq } from 'drizzle-orm';
import { afterAll, describe, expect, it } from 'vitest';
import { courseAccess } from '../../db/schema/training-progress';
import { testDb, testDbUrl } from '../../db/test-db';
import { listAccess } from './access-list';
import { grantExtraAttempt } from './quiz-extra';
import { pastAttempt, quizCourse } from './quiz-test-support';
import { accessRow, auditOf, IP, staff } from './test-support';

/* docs/03 sections 18.3 p. 1, 18.6 p. 1; docs/05 section 27 "Requests"; docs/04 `training.manage`;
 * decisions — docs/todo.md 9.6 (8). */

const deps = { ip: IP };
const badState = { ok: false, reason: 'bad_state' };

describe.skipIf(!testDbUrl)('training quiz: an extra attempt from the admin', () => {
	const { inRollback, close } = testDb();
	afterAll(close);

	it('admin: +1 to the unused extra attempts, logged with before and after', async () => {
		await inRollback(async (tx) => {
			const admin = await staff(tx);
			const { course, member, accessId } = await quizCourse(tx);
			expect(await grantExtraAttempt(tx, admin, accessId, deps)).toEqual({ ok: true });
			expect(await grantExtraAttempt(tx, admin, accessId, deps)).toEqual({ ok: true });
			expect((await accessRow(tx, accessId)).extraAttempts).toBe(2);
			const entries = await auditOf(tx, 'course_access', accessId);
			expect(entries).toHaveLength(2);
			expect(entries[0]).toMatchObject({
				action: 'course_access.extra_attempt',
				actorId: admin.id,
				ip: IP,
				before: { extraAttempts: 0 },
				after: { extraAttempts: 1, courseId: course.id, userId: member.id }
			});
		});
	});

	it('editor and moderator — not allowed, nothing changes', async () => {
		await inRollback(async (tx) => {
			const { accessId } = await quizCourse(tx);
			for (const role of ['editor', 'moderator'] as const) {
				const actor = await staff(tx, role);
				expect(await grantExtraAttempt(tx, actor, accessId, deps)).toEqual({
					ok: false,
					reason: 'not_allowed'
				});
			}
			expect((await accessRow(tx, accessId)).extraAttempts).toBe(0);
			expect(await auditOf(tx, 'course_access', accessId)).toHaveLength(0);
		});
	});

	it('only an approved request of an unfinished course with the test not passed', async () => {
		await inRollback(async (tx) => {
			const admin = await staff(tx);
			const { course, member, accessId } = await quizCourse(tx);
			await tx
				.update(courseAccess)
				.set({ status: 'revoked', reviewNote: 'Нарушение' })
				.where(eq(courseAccess.id, accessId));
			expect(await grantExtraAttempt(tx, admin, accessId, deps)).toEqual(badState);
			await tx
				.update(courseAccess)
				.set({ status: 'approved', reviewNote: null })
				.where(eq(courseAccess.id, accessId));
			await pastAttempt(tx, course.id, member.id, new Date(Date.now() - 86_400_000), {
				correctCount: 4,
				passed: true
			});
			expect(await grantExtraAttempt(tx, admin, accessId, deps)).toEqual(badState);
			expect(await grantExtraAttempt(tx, admin, crypto.randomUUID(), deps)).toEqual({
				ok: false,
				reason: 'not_found'
			});
			expect(await grantExtraAttempt(tx, admin, 'nope', deps)).toEqual({
				ok: false,
				reason: 'not_found'
			});
		});
	});

	it('the request list shows the unused extra attempts', async () => {
		await inRollback(async (tx) => {
			const admin = await staff(tx);
			const { course, accessId } = await quizCourse(tx);
			await grantExtraAttempt(tx, admin, accessId, deps);
			const { rows } = await listAccess(tx, { status: 'approved', courseId: course.id, page: 1 });
			expect(rows.find((r) => r.id === accessId)).toMatchObject({ extraAttempts: 1 });
		});
	});
});
