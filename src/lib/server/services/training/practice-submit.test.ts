import { eq } from 'drizzle-orm';
import { afterAll, describe, expect, it } from 'vitest';
import { exams } from '../../db/schema/certification';
import { courseAccess } from '../../db/schema/training-progress';
import { testDb, testDbUrl } from '../../db/test-db';
import { practicePage } from './practice-read';
import { submitPractice } from './practice-submit';
import {
	insertSubmission,
	insertTask,
	practiceCourse,
	submissionsOf,
	YT
} from './practice-test-support';
import { staff } from './test-support';

/* docs/03 section 18.4 p. 1–3, 18.1 p. 3–4, docs/06 section 5.11 "Practice"; decisions —
 * docs/todo.md 9.7 (3, 5). */

const LINK = 'https://youtu.be/ppppppppppA';
const STORED = 'https://www.youtube.com/watch?v=ppppppppppA';
const refused = (reason: string) => ({ ok: false, reason });

describe.skipIf(!testDbUrl)('training practice: the member sends a link', () => {
	const { inRollback, close } = testDb();
	afterAll(close);

	it('after the passed quiz: a pending submission with the normalized link', async () => {
		await inRollback(async (tx) => {
			const { course, member, tasks } = await practiceCourse(tx);
			const result = await submitPractice(tx, member, course.slug, tasks[0], LINK);
			expect(result).toEqual({ ok: true, replaced: false });
			const [row] = await submissionsOf(tx, tasks[0]);
			expect(row).toMatchObject({
				userId: member.id,
				url: STORED,
				platform: 'youtube',
				status: 'pending',
				reviewedAt: null
			});
		});
	});

	it('while pending the link is replaced, not added; after approval — refused', async () => {
		await inRollback(async (tx) => {
			const { course, member, tasks } = await practiceCourse(tx);
			await submitPractice(tx, member, course.slug, tasks[0], LINK);
			const drive = 'https://drive.google.com/open?id=1AbCdEfGhIjKlMnOp';
			expect(await submitPractice(tx, member, course.slug, tasks[0], drive)).toEqual({
				ok: true,
				replaced: true
			});
			const rows = await submissionsOf(tx, tasks[0]);
			expect(rows).toHaveLength(1);
			expect(rows[0]).toMatchObject({
				platform: 'google_drive',
				url: 'https://drive.google.com/file/d/1AbCdEfGhIjKlMnOp/view'
			});
			await insertSubmission(tx, tasks[1], member.id, {
				status: 'approved',
				reviewedAt: new Date()
			});
			expect(await submitPractice(tx, member, course.slug, tasks[1], LINK)).toEqual(
				refused('bad_state')
			);
		});
	});

	it('after a return a new submission is added; retakes have no limit', async () => {
		await inRollback(async (tx) => {
			const { course, member, tasks } = await practiceCourse(tx);
			for (const n of [1, 2]) {
				await insertSubmission(tx, tasks[0], member.id, {
					url: YT(n),
					status: 'rejected',
					reviewedAt: new Date(),
					reviewNote: 'Не видно приземления'
				});
			}
			expect(await submitPractice(tx, member, course.slug, tasks[0], LINK)).toEqual({
				ok: true,
				replaced: false
			});
			const rows = await submissionsOf(tx, tasks[0]);
			expect(rows.map((r) => r.status).sort()).toEqual(['pending', 'rejected', 'rejected']);
		});
	});

	it('closed before the quiz is passed, after the course is finished, for a bad link', async () => {
		await inRollback(async (tx) => {
			const fresh = await practiceCourse(tx, { passed: false });
			expect(
				await submitPractice(tx, fresh.member, fresh.course.slug, fresh.tasks[0], LINK)
			).toEqual(refused('quiz'));
			const { course, member, tasks, accessId } = await practiceCourse(tx);
			for (const bad of [
				'https://vimeo.com/1',
				'https://drive.google.com/drive/folders/1AbCdEfGhIj'
			]) {
				expect(await submitPractice(tx, member, course.slug, tasks[0], bad)).toEqual(
					refused('bad_url')
				);
			}
			const [exam] = await tx
				.insert(exams)
				.values({ userId: member.id, kind: 'trainer', result: 'passed', decidedAt: new Date() })
				.returning({ id: exams.id });
			await tx.update(courseAccess).set({ examId: exam.id }).where(eq(courseAccess.id, accessId));
			expect(await submitPractice(tx, member, course.slug, tasks[0], LINK)).toEqual(
				refused('finished')
			);
			expect(await submissionsOf(tx, tasks[0])).toHaveLength(0);
		});
	});

	it('a hidden task, a task of another course, a swapped id — not found', async () => {
		await inRollback(async (tx) => {
			const { course, member, tasks } = await practiceCourse(tx);
			const other = await practiceCourse(tx);
			const hidden = await insertTask(tx, course.id, 5, { hiddenAt: new Date() });
			for (const taskId of [hidden, other.tasks[0], crypto.randomUUID(), 'nope']) {
				expect(await submitPractice(tx, member, course.slug, taskId, LINK)).toEqual(
					refused('not_found')
				);
			}
			expect(await submitPractice(tx, member, other.course.slug, tasks[0], LINK)).toEqual(
				refused('not_found')
			);
		});
	});

	it('preview (admin without a request) does not submit; a revoked member — not found', async () => {
		await inRollback(async (tx) => {
			const { course, member, tasks, accessId } = await practiceCourse(tx);
			const admin = await staff(tx);
			expect(await submitPractice(tx, admin, course.slug, tasks[0], LINK)).toEqual(
				refused('preview')
			);
			await tx
				.update(courseAccess)
				.set({ status: 'revoked', reviewNote: 'Нарушение' })
				.where(eq(courseAccess.id, accessId));
			expect(await submitPractice(tx, member, course.slug, tasks[0], LINK)).toEqual(
				refused('not_found')
			);
			expect(await submissionsOf(tx, tasks[0])).toHaveLength(0);
		});
	});
});

describe.skipIf(!testDbUrl)('training practice: the member page', () => {
	const { inRollback, close } = testDb();
	afterAll(close);

	it('visible tasks in order with the current state, the history and accepted N of M', async () => {
		await inRollback(async (tx) => {
			const { course, member, tasks } = await practiceCourse(tx);
			await insertTask(tx, course.id, 9, { hiddenAt: new Date() });
			const day = 86_400_000;
			await insertSubmission(tx, tasks[0], member.id, {
				url: YT(1),
				status: 'rejected',
				reviewedAt: new Date(),
				reviewNote: 'Камера далеко',
				createdAt: new Date(Date.now() - 2 * day)
			});
			await insertSubmission(tx, tasks[0], member.id, {
				url: YT(2),
				status: 'approved',
				reviewedAt: new Date(),
				createdAt: new Date(Date.now() - day)
			});
			await insertSubmission(tx, tasks[1], member.id, {
				url: YT(3),
				status: 'rejected',
				reviewedAt: new Date(),
				reviewNote: 'Нет второго элемента'
			});
			const page = await practicePage(tx, member, course.slug);
			expect(page?.state).toBe('open');
			expect(page?.accepted).toBe(1);
			expect(page?.total).toBe(2);
			expect(page?.tasks.map((t) => t.id)).toEqual(tasks);
			expect(page?.tasks[0].current).toMatchObject({ status: 'approved', url: YT(2) });
			expect(page?.tasks[0].history.map((h) => h.url)).toEqual([YT(2), YT(1)]);
			expect(page?.tasks[1].current).toMatchObject({
				status: 'rejected',
				note: 'Нет второго элемента'
			});
		});
	});

	it('before the quiz — the list without a form; preview for the admin; 404 for others', async () => {
		await inRollback(async (tx) => {
			const { course, member } = await practiceCourse(tx, { passed: false });
			expect((await practicePage(tx, member, course.slug))?.state).toBe('quiz');
			expect((await practicePage(tx, await staff(tx), course.slug))?.state).toBe('preview');
			expect(await practicePage(tx, await staff(tx, 'moderator'), course.slug)).toBeNull();
			expect(await practicePage(tx, member, 'no-such-course')).toBeNull();
		});
	});
});
