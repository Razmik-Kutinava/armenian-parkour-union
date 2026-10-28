import { afterAll, describe, expect, it } from 'vitest';
import type { PortalText } from '#lib/i18n/localized.ts';
import { testDb, testDbUrl } from '../../db/test-db';
import { getTask, listTasks } from './practice-task-list';
import { createTask, setTaskHidden, updateTask } from './practice-tasks';
import { insertSubmission } from './practice-test-support';
import { applicant, auditOf, insertCourse, IP, staff } from './test-support';

/* docs/05 section 27 "Practice tasks" (admin), docs/04 `training.manage`; decisions —
 * docs/todo.md 9.7 (1). Tasks are never deleted. */

const values = (en: string, sortOrder = 0) => ({
	title: { en } as PortalText,
	description: { ru: '<p>Конг через препятствие</p>' },
	sortOrder
});
const titles = async (tx: Parameters<typeof listTasks>[0], courseId: string) =>
	(await listTasks(tx, courseId)).map((t) => (t.title as { en: string }).en);

describe.skipIf(!testDbUrl)('training: practice tasks in the admin', () => {
	const { inRollback, close } = testDb();
	afterAll(close);

	it('admin creates and edits; the list follows the order; both are logged', async () => {
		await inRollback(async (tx) => {
			const admin = await staff(tx);
			const courseId = await insertCourse(tx);
			const a = await createTask(tx, admin, courseId, values('Kong', 2), IP);
			const b = await createTask(tx, admin, courseId, values('Monkey', 1), IP);
			if (typeof a === 'string' || typeof b === 'string') throw new Error('refused');
			expect(await titles(tx, courseId)).toEqual(['Monkey', 'Kong']);
			const next = { ...values('Kong vault', 2), description: { ru: '<p>Новое</p>' } };
			expect(await updateTask(tx, admin, courseId, a.id, next, IP)).toBe('ok');
			expect(await getTask(tx, courseId, a.id)).toMatchObject({
				title: { en: 'Kong vault' },
				description: { ru: '<p>Новое</p>' },
				sortOrder: 2
			});
			const entries = await auditOf(tx, 'practice_task', a.id);
			expect(entries.map((e) => e.action)).toEqual([
				'practice_task.create',
				'practice_task.update'
			]);
			expect(entries[0]).toMatchObject({ actorId: admin.id, ip: IP, after: { courseId } });
			expect(entries[1]).toMatchObject({
				before: { title: { en: 'Kong' } },
				after: { title: { en: 'Kong vault' }, descriptionChanged: true }
			});
		});
	});

	it('saving without changes writes nothing to the log', async () => {
		await inRollback(async (tx) => {
			const admin = await staff(tx);
			const courseId = await insertCourse(tx);
			const task = await createTask(tx, admin, courseId, values('Dash'), IP);
			if (typeof task === 'string') throw new Error(task);
			expect(await updateTask(tx, admin, courseId, task.id, values('Dash'), IP)).toBe('ok');
			expect(await auditOf(tx, 'practice_task', task.id)).toHaveLength(1);
		});
	});

	it('hide and restore are logged; a repeat is refused; the list counts pending and accepted', async () => {
		await inRollback(async (tx) => {
			const admin = await staff(tx);
			const courseId = await insertCourse(tx);
			const task = await createTask(tx, admin, courseId, values('Precision'), IP);
			if (typeof task === 'string') throw new Error(task);
			expect(await setTaskHidden(tx, admin, courseId, task.id, true, IP)).toBe('ok');
			expect(await setTaskHidden(tx, admin, courseId, task.id, true, IP)).toBe('bad_state');
			expect((await getTask(tx, courseId, task.id))?.hiddenAt).toBeInstanceOf(Date);
			expect(await setTaskHidden(tx, admin, courseId, task.id, false, IP)).toBe('ok');
			const actions = (await auditOf(tx, 'practice_task', task.id)).map((e) => e.action);
			expect(actions).toEqual([
				'practice_task.create',
				'practice_task.hide',
				'practice_task.restore'
			]);
			const one = await applicant(tx);
			const two = await applicant(tx);
			await insertSubmission(tx, task.id, one.id);
			await insertSubmission(tx, task.id, two.id, {
				status: 'approved',
				reviewedAt: new Date()
			});
			expect((await listTasks(tx, courseId))[0]).toMatchObject({ pending: 1, accepted: 1 });
		});
	});

	it('editor and moderator — not allowed; a task of another course — not found', async () => {
		await inRollback(async (tx) => {
			const admin = await staff(tx);
			const courseId = await insertCourse(tx);
			const other = await insertCourse(tx);
			const task = await createTask(tx, admin, courseId, values('Roll'), IP);
			if (typeof task === 'string') throw new Error(task);
			for (const role of ['editor', 'moderator'] as const) {
				const actor = await staff(tx, role);
				expect(await createTask(tx, actor, courseId, values('X'), IP)).toBe('not_allowed');
				expect(await updateTask(tx, actor, courseId, task.id, values('X'), IP)).toBe('not_allowed');
				expect(await setTaskHidden(tx, actor, courseId, task.id, true, IP)).toBe('not_allowed');
			}
			expect(await updateTask(tx, admin, other, task.id, values('X'), IP)).toBe('not_found');
			expect(await setTaskHidden(tx, admin, other, task.id, true, IP)).toBe('not_found');
			expect(await createTask(tx, admin, crypto.randomUUID(), values('X'), IP)).toBe('not_found');
			expect(await getTask(tx, other, task.id)).toBeNull();
			expect(await getTask(tx, courseId, 'nope')).toBeNull();
		});
	});
});
