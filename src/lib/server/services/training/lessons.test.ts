import { eq } from 'drizzle-orm';
import { afterAll, describe, expect, it } from 'vitest';
import type { LimitDb } from '../../auth/rate-limit';
import { media } from '../../db/schema/service';
import { courseLessons } from '../../db/schema/training';
import { testDb, testDbUrl } from '../../db/test-db';
import { findUsages } from '../media/usage';
import { getLesson, listLessons } from './lesson-list';
import { createLesson, deleteLesson, updateLesson } from './lessons';
import { auditOf, insertCourse, insertTopic, IP, lessonValues, staff } from './test-support';

/* docs/05 section 27 "Lessons", docs/03 section 18.2; decisions — docs/todo.md 9.2 (3, 5). */

type Actor = { id: string; role: 'admin' | 'editor' };

async function lesson(tx: LimitDb, actor: Actor, courseId: string, v = lessonValues()) {
	const result = await createLesson(tx, actor, courseId, v, IP);
	if (typeof result === 'string') throw new Error(result);
	return result.id;
}

const stored = async (tx: LimitDb, id: string) =>
	(await tx.select().from(courseLessons).where(eq(courseLessons.id, id)))[0];

describe.skipIf(!testDbUrl)('training: lessons in the admin', () => {
	const { inRollback, close } = testDb();
	afterAll(close);

	it('an editor creates and edits a lesson; both are logged', async () => {
		await inRollback(async (tx) => {
			const editor = (await staff(tx, 'editor')) as Actor;
			const courseId = await insertCourse(tx);
			const topicId = await insertTopic(tx, courseId);
			const id = await lesson(tx, editor, courseId, lessonValues({ topicId }));
			expect(await stored(tx, id)).toMatchObject({
				courseId,
				topicId,
				title: { en: 'Safety first' },
				body: { en: '<p>Warm up</p>' },
				status: 'draft',
				createdBy: editor.id,
				fileKey: null
			});
			const next = lessonValues({ topicId: null, status: 'published', sortOrder: 3 });
			expect(await updateLesson(tx, editor, courseId, id, next, IP)).toBe('ok');
			expect(await stored(tx, id)).toMatchObject({ topicId: null, status: 'published' });
			const entries = await auditOf(tx, 'course_lesson', id);
			expect(entries.map((e) => e.action)).toEqual(['course_lesson.create', 'course_lesson.update']);
			expect(entries[1]).toMatchObject({ actorId: editor.id, ip: IP });
			expect(entries[1].after).toEqual({ topicId: null, status: 'published', sortOrder: 3 });
		});
	});

	it('the topic must be of the same course', async () => {
		await inRollback(async (tx) => {
			const admin = (await staff(tx)) as Actor;
			const courseId = await insertCourse(tx);
			const foreign = await insertTopic(tx, await insertCourse(tx));
			const bad = lessonValues({ topicId: foreign });
			expect(await createLesson(tx, admin, courseId, bad, IP)).toBe('bad_topic');
			const id = await lesson(tx, admin, courseId);
			expect(await updateLesson(tx, admin, courseId, id, bad, IP)).toBe('bad_topic');
			const unknown = lessonValues({ topicId: crypto.randomUUID() });
			expect(await createLesson(tx, admin, courseId, unknown, IP)).toBe('bad_topic');
		});
	});

	it('a moderator or member may not touch lessons; another course does not find it', async () => {
		await inRollback(async (tx) => {
			const admin = (await staff(tx)) as Actor;
			const courseId = await insertCourse(tx);
			const id = await lesson(tx, admin, courseId);
			for (const role of ['moderator', 'member'] as const) {
				const actor = await staff(tx, role);
				expect(await createLesson(tx, actor, courseId, lessonValues(), IP)).toBe('not_allowed');
				expect(await updateLesson(tx, actor, courseId, id, lessonValues(), IP)).toBe(
					'not_allowed'
				);
				expect(await deleteLesson(tx, actor, courseId, id, IP)).toBe('not_allowed');
			}
			const other = await insertCourse(tx);
			expect(await updateLesson(tx, admin, other, id, lessonValues(), IP)).toBe('not_found');
			expect(await deleteLesson(tx, admin, other, id, IP)).toBe('not_found');
			expect(await getLesson(tx, other, id)).toBeNull();
			expect(await createLesson(tx, admin, crypto.randomUUID(), lessonValues(), IP)).toBe(
				'not_found'
			);
		});
	});

	it('delete is soft and logged; a deleted lesson is gone from the list and the card', async () => {
		await inRollback(async (tx) => {
			const admin = (await staff(tx)) as Actor;
			const courseId = await insertCourse(tx);
			const id = await lesson(tx, admin, courseId);
			expect(await deleteLesson(tx, admin, courseId, id, IP)).toBe('ok');
			expect((await stored(tx, id)).deletedAt).toBeInstanceOf(Date);
			expect(await deleteLesson(tx, admin, courseId, id, IP)).toBe('not_found');
			expect(await listLessons(tx, courseId)).toEqual([]);
			expect(await getLesson(tx, courseId, id)).toBeNull();
			expect((await auditOf(tx, 'course_lesson', id)).at(-1)?.action).toBe('course_lesson.delete');
		});
	});

	it('the list follows the topic order, lessons without a topic last', async () => {
		await inRollback(async (tx) => {
			const admin = (await staff(tx)) as Actor;
			const courseId = await insertCourse(tx);
			const second = await insertTopic(tx, courseId, 2);
			const first = await insertTopic(tx, courseId, 1);
			const v = (en: string, topicId: string | null, sortOrder: number) =>
				lessonValues({ title: { en }, topicId, sortOrder });
			await lesson(tx, admin, courseId, v('loose', null, 0));
			await lesson(tx, admin, courseId, v('2a', second, 0));
			await lesson(tx, admin, courseId, v('1b', first, 5));
			await lesson(tx, admin, courseId, v('1a', first, 1));
			const rows = await listLessons(tx, courseId);
			expect(rows.map((r) => (r.title as { en: string }).en)).toEqual(['1a', '1b', '2a', 'loose']);
			expect(rows[0]).toMatchObject({ topicId: first, hasFile: false, status: 'draft' });
		});
	});

	it('a library image in the lesson text is found as used until the lesson is deleted', async () => {
		await inRollback(async (tx) => {
			const admin = (await staff(tx)) as Actor;
			const key = `media/2026/10/${crypto.randomUUID()}.png`;
			await tx.insert(media).values({
				key,
				originalName: 'l.png',
				mime: 'image/png',
				sizeBytes: 10,
				uploadedBy: admin.id
			});
			const courseId = await insertCourse(tx);
			const body = { en: `<p><img src="https://media.parkour.am/${key}" alt=""></p>` };
			const id = await lesson(tx, admin, courseId, lessonValues({ body }));
			expect(await findUsages(tx, key)).toEqual([{ kind: 'course_lesson', id }]);
			await deleteLesson(tx, admin, courseId, id, IP);
			expect(await findUsages(tx, key)).toEqual([]);
		});
	});
});
