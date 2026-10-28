import { eq } from 'drizzle-orm';
import { afterAll, describe, expect, it } from 'vitest';
import type { LimitDb } from '../../auth/rate-limit';
import { exams } from '../../db/schema/certification';
import { courseAccess, practiceTasks } from '../../db/schema/training-progress';
import { testDb, testDbUrl } from '../../db/test-db';
import { setTaskHidden } from './practice-tasks';
import { insertSubmission, practiceCourse } from './practice-test-support';
import { pastAttempt } from './quiz-test-support';
import { accessRow, applicant, auditOf, IP, mailbox, setFederationEmail, SITE, staff } from './test-support';

/* docs/03 sections 18.5–18.6; decisions — docs/todo.md 9.13 (1–8): hiding the last task a member
 * has not got accepted finishes the course in the same transaction, the admin is the actor. */

const FED = 'federation@parkour.test';
const deps = (send = mailbox().send) => ({ send, siteUrl: SITE, ip: IP });
const examsOf = (tx: LimitDb, userId: string) =>
	tx.select().from(exams).where(eq(exams.userId, userId));
const accept = (tx: LimitDb, taskId: string, userId: string, reviewedBy: string) =>
	insertSubmission(tx, taskId, userId, {
		status: 'approved',
		reviewedBy,
		reviewedAt: new Date(Date.now() - 60_000)
	});
const hideDirectly = (tx: LimitDb, taskId: string) =>
	tx.update(practiceTasks).set({ hiddenAt: new Date() }).where(eq(practiceTasks.id, taskId));

/** Another member of the same course: approved (or revoked), quiz passed unless `passed: false`. */
async function join(tx: LimitDb, courseId: string, { passed = true, revoked = false } = {}) {
	const user = await applicant(tx);
	const [access] = await tx
		.insert(courseAccess)
		.values({
			courseId,
			userId: user.id,
			status: revoked ? 'revoked' : 'approved',
			reviewedAt: new Date(),
			reviewNote: revoked ? 'Нарушение' : null
		})
		.returning({ id: courseAccess.id });
	if (passed) {
		await pastAttempt(tx, courseId, user.id, new Date(Date.now() - 86_400_000), {
			correctCount: 4,
			passed: true
		});
	}
	return { user, accessId: access.id };
}

describe.skipIf(!testDbUrl)('training: hiding a practice task finishes the course', () => {
	const { inRollback, close } = testDb();
	afterAll(close);

	it('the last unaccepted task hidden: one passed exam by the admin, letters to the member and the admin', async () => {
		await inRollback(async (tx) => {
			await setFederationEmail(tx, FED);
			const { course, user, accessId, tasks } = await practiceCourse(tx);
			const moderator = await staff(tx, 'moderator');
			await accept(tx, tasks[0], user.id, moderator.id);
			await insertSubmission(tx, tasks[1], user.id);
			const admin = await staff(tx);
			const box = mailbox();
			expect(await setTaskHidden(tx, admin, course.id, tasks[1], true, deps(box.send))).toBe('ok');
			const [exam] = await examsOf(tx, user.id);
			expect((await accessRow(tx, accessId)).examId).toBe(exam?.id);
			expect(exam).toMatchObject({
				userId: user.id,
				kind: 'trainer',
				result: 'passed',
				score: '100.00',
				examinerId: moderator.id,
				notes: 'Training portal: quiz 4/4, practice 1/1'
			});
			const [task] = await tx.select().from(practiceTasks).where(eq(practiceTasks.id, tasks[1]));
			expect(exam.decidedAt).toEqual(task.hiddenAt);
			const entries = await auditOf(tx, 'exam', exam.id);
			expect(entries).toHaveLength(1);
			expect(entries[0]).toMatchObject({
				action: 'exam.course_complete',
				actorId: admin.id,
				ip: IP,
				after: { courseId: course.id, userId: user.id, examinerId: moderator.id }
			});
			const hides = await auditOf(tx, 'practice_task', tasks[1]);
			expect(hides.map((e) => e.action)).toEqual(['practice_task.hide']);
			expect(box.sent.map((m) => m.to)).toEqual([user.email, FED]);
			expect(box.sent[1].text).toContain(`${SITE}/admin/exams/${exam.id}`);
		});
	});

	it('only members with the quiz passed and every other visible task accepted; other courses untouched', async () => {
		await inRollback(async (tx) => {
			await setFederationEmail(tx, null);
			const { course, user, accessId, tasks } = await practiceCourse(tx);
			const moderator = await staff(tx, 'moderator');
			await accept(tx, tasks[0], user.id, moderator.id);
			const nothing = await join(tx, course.id);
			const noQuiz = await join(tx, course.id, { passed: false });
			await accept(tx, tasks[0], noQuiz.user.id, moderator.id);
			const revoked = await join(tx, course.id, { revoked: true });
			await accept(tx, tasks[0], revoked.user.id, moderator.id);
			const done = await join(tx, course.id);
			await accept(tx, tasks[0], done.user.id, moderator.id);
			const [old] = await tx
				.insert(exams)
				.values({ userId: done.user.id, kind: 'trainer', result: 'passed', decidedAt: new Date() })
				.returning({ id: exams.id });
			await tx.update(courseAccess).set({ examId: old.id }).where(eq(courseAccess.id, done.accessId));
			const other = await practiceCourse(tx);
			await accept(tx, other.tasks[0], other.user.id, moderator.id);
			await hideDirectly(tx, other.tasks[1]);

			const admin = await staff(tx);
			const box = mailbox();
			expect(await setTaskHidden(tx, admin, course.id, tasks[1], true, deps(box.send))).toBe('ok');
			expect((await accessRow(tx, accessId)).examId).not.toBeNull();
			for (const m of [nothing, noQuiz, revoked]) {
				expect((await accessRow(tx, m.accessId)).examId).toBeNull();
				expect(await examsOf(tx, m.user.id)).toEqual([]);
			}
			expect(await examsOf(tx, done.user.id)).toHaveLength(1);
			expect((await accessRow(tx, done.accessId)).examId).toBe(old.id);
			expect((await accessRow(tx, other.accessId)).examId).toBeNull();
			expect(box.sent.map((m) => m.to)).toEqual([user.email]);
		});
	});

	it('no visible task left: the quiz alone finishes the course, no examiner', async () => {
		await inRollback(async (tx) => {
			const { course, user, accessId, tasks } = await practiceCourse(tx);
			await hideDirectly(tx, tasks[0]);
			const admin = await staff(tx);
			expect(await setTaskHidden(tx, admin, course.id, tasks[1], true, deps())).toBe('ok');
			const { examId } = await accessRow(tx, accessId);
			expect(examId).not.toBeNull();
			expect(await examsOf(tx, user.id)).toMatchObject([{ result: 'passed', examinerId: null }]);
		});
	});

	it('a failing mail keeps the exam; restore finishes nothing and keeps the finished course', async () => {
		await inRollback(async (tx) => {
			const { course, user, accessId, tasks } = await practiceCourse(tx);
			const moderator = await staff(tx, 'moderator');
			await accept(tx, tasks[0], user.id, moderator.id);
			const admin = await staff(tx);
			const down = deps(mailbox(true).send);
			expect(await setTaskHidden(tx, admin, course.id, tasks[1], true, down)).toBe('ok');
			const { examId } = await accessRow(tx, accessId);
			expect(examId).not.toBeNull();

			const box = mailbox();
			expect(await setTaskHidden(tx, admin, course.id, tasks[1], false, deps(box.send))).toBe('ok');
			expect((await accessRow(tx, accessId)).examId).toBe(examId);
			expect(await examsOf(tx, user.id)).toHaveLength(1);
			expect(box.sent).toEqual([]);
		});
	});
});
