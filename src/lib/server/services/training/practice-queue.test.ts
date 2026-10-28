import { afterAll, describe, expect, it } from 'vitest';
import { testDb, testDbUrl } from '../../db/test-db';
import { listPractice, practiceDetail } from './practice-queue';
import { insertSubmission, practiceCourse, YT } from './practice-test-support';
import { staff } from './test-support';

/* docs/05 section 27 "Practice": pending by default, oldest on top, filters course, task, status;
 * the card with the task, the history and no buttons for own videos. Decisions — docs/todo.md 9.7 (6). */

const DAY = 86_400_000;
const ago = (days: number) => new Date(Date.now() - days * DAY);
const decided = { reviewedAt: new Date(), reviewNote: 'Плохо видно' };

describe.skipIf(!testDbUrl)('training practice: the review queue', () => {
	const { inRollback, close } = testDb();
	afterAll(close);

	it('pending by default, oldest first; filters by course, task and status', async () => {
		await inRollback(async (tx) => {
			const a = await practiceCourse(tx);
			const b = await practiceCourse(tx);
			const newer = await insertSubmission(tx, a.tasks[0], a.member.id, { createdAt: ago(1) });
			const older = await insertSubmission(tx, b.tasks[1], b.member.id, { createdAt: ago(3) });
			const done = await insertSubmission(tx, a.tasks[1], a.member.id, {
				status: 'rejected',
				createdAt: ago(5),
				...decided
			});
			const ours = [newer, older, done];
			const ids = async (filter: Parameters<typeof listPractice>[1]) =>
				(await listPractice(tx, filter)).rows.map((r) => r.id).filter((id) => ours.includes(id));
			const base = { status: 'pending', courseId: null, taskId: null, page: 1 } as const;
			expect(await ids(base)).toEqual([older, newer]);
			expect(await ids({ ...base, courseId: a.course.id })).toEqual([newer]);
			expect(await ids({ ...base, taskId: b.tasks[1] })).toEqual([older]);
			expect(await ids({ ...base, status: 'rejected' })).toEqual([done]);
			expect(await ids({ ...base, status: 'all' })).toEqual([done, older, newer]);
			const row = (await listPractice(tx, { ...base, courseId: a.course.id })).rows[0];
			expect(row).toMatchObject({
				userId: a.member.id,
				taskId: a.tasks[0],
				url: YT(1),
				platform: 'youtube',
				status: 'pending',
				taskTitle: { ru: 'Задание 0' }
			});
		});
	});

	it('the card: the task text, earlier submissions of this member on this task, own flag', async () => {
		await inRollback(async (tx) => {
			const { member, tasks } = await practiceCourse(tx);
			const first = await insertSubmission(tx, tasks[0], member.id, {
				url: YT(1),
				status: 'rejected',
				createdAt: ago(4),
				...decided
			});
			await insertSubmission(tx, tasks[1], member.id, { url: YT(9), createdAt: ago(3) });
			const id = await insertSubmission(tx, tasks[0], member.id, { url: YT(2), createdAt: ago(1) });
			const moderator = await staff(tx, 'moderator');
			const card = await practiceDetail(tx, id, moderator.id);
			expect(card).toMatchObject({
				id,
				url: YT(2),
				status: 'pending',
				own: false,
				task: { id: tasks[0], title: { ru: 'Задание 0' }, description: { ru: '<p>Манки, конг</p>' } }
			});
			expect(card?.history.map((h) => h.id)).toEqual([first]);
			expect(card?.history[0]).toMatchObject({ status: 'rejected', note: 'Плохо видно' });
			expect((await practiceDetail(tx, id, member.id))?.own).toBe(true);
			expect(await practiceDetail(tx, crypto.randomUUID(), moderator.id)).toBeNull();
			expect(await practiceDetail(tx, 'nope', moderator.id)).toBeNull();
		});
	});
});
