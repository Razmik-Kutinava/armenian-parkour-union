import { afterAll, describe, expect, it } from 'vitest';
import { taskFormSchema } from '#lib/validation/training-practice.ts';
import type { LimitDb } from '../../auth/rate-limit';
import { media } from '../../db/schema/service';
import { testDb, testDbUrl } from '../../db/test-db';
import { deleteMedia } from '../media/edit';
import { findUsages } from '../media/usage';
import { createTask, setTaskHidden, updateTask } from './practice-tasks';
import { accessDeps, insertCourse, IP, mailbox, staff } from './test-support';

/* Library images in a practice task description; decisions — docs/todo.md 9.15. */

const BASE = 'https://media.parkour.am';
const DEPS = accessDeps(mailbox().send);

async function libraryFile(tx: LimitDb, uploadedBy: string) {
	const key = `media/2026/10/${crypto.randomUUID()}.png`;
	const [row] = await tx
		.insert(media)
		.values({ key, originalName: 't.png', mime: 'image/png', sizeBytes: 10, uploadedBy })
		.returning({ id: media.id });
	return { id: row.id, key };
}

const form = (key: string, base: string | null) =>
	taskFormSchema(base).parse({
		title: { en: 'Kong' },
		description: { en: `<p>Like this:</p><p><img src="${BASE}/${key}" alt=""></p>` }
	});

describe('practice task form: library images', () => {
	it('kept with the library address, dropped without it', () => {
		expect(form('media/2026/10/a.png', BASE).description.en).toContain(`${BASE}/media/2026/10/a.png`);
		expect(form('media/2026/10/a.png', null).description.en).not.toContain('<img');
	});
});

describe.skipIf(!testDbUrl)('training: library images in practice tasks', () => {
	const { inRollback, close } = testDb();
	afterAll(close);

	it('an image in the description is in use, the task hidden too; the file cannot be deleted', async () => {
		await inRollback(async (tx) => {
			const admin = await staff(tx);
			const file = await libraryFile(tx, admin.id);
			const courseId = await insertCourse(tx);
			const task = await createTask(tx, admin, courseId, form(file.key, BASE), IP);
			if (typeof task === 'string') throw new Error(task);
			const used = [{ kind: 'practice_task', id: task.id, courseId }];
			expect(await findUsages(tx, file.key)).toEqual(used);
			expect(await setTaskHidden(tx, admin, courseId, task.id, true, DEPS)).toBe('ok');
			expect(await findUsages(tx, file.key)).toEqual(used);
			expect(await deleteMedia(tx, admin, file.id, IP)).toEqual({ inUse: used });
		});
	});

	it('an image added by an edit is in use; removed by an edit — no longer', async () => {
		await inRollback(async (tx) => {
			const admin = await staff(tx);
			const file = await libraryFile(tx, admin.id);
			const courseId = await insertCourse(tx);
			const plain = { ...form(file.key, null), description: { en: '<p>Kong</p>' } };
			const task = await createTask(tx, admin, courseId, plain, IP);
			if (typeof task === 'string') throw new Error(task);
			expect(await findUsages(tx, file.key)).toEqual([]);
			expect(await updateTask(tx, admin, courseId, task.id, form(file.key, BASE), IP)).toBe('ok');
			expect(await findUsages(tx, file.key)).toHaveLength(1);
			expect(await updateTask(tx, admin, courseId, task.id, plain, IP)).toBe('ok');
			expect(await findUsages(tx, file.key)).toEqual([]);
		});
	});
});
