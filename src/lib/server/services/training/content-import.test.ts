import { and, eq, inArray } from 'drizzle-orm';
import { afterAll, describe, expect, it } from 'vitest';
import { courseContentSchema } from '#lib/validation/training-content.ts';
import type { LimitDb } from '../../auth/rate-limit';
import { auditLog } from '../../db/schema/service';
import { courseLessons, courseTopics } from '../../db/schema/training';
import { practiceTasks } from '../../db/schema/training-progress';
import { testDb, testDbUrl } from '../../db/test-db';
import { importCourseContent } from './content-import';
import { IP, insertOpenCourse, staff } from './test-support';
import { createTopic } from './topics';

/* Course content import (roadmap 9.9); decisions — docs/todo.md 9.9. */

const lesson = (ru: string) => ({ title: { ru }, body: { ru: `<h2>${ru}</h2><p>Текст</p>` } });
const task = (ru: string) => ({ title: { ru }, description: { ru: `<p>${ru}: снять видео</p>` } });
const content = () =>
	courseContentSchema(null).parse({
		topics: [
			{ title: { ru: '1-й год' }, lessons: [lesson('Вводная'), lesson('Модуль 1')] },
			{ title: { ru: 'Первая помощь' }, lessons: [lesson('Курс первой помощи')] }
		],
		practiceTasks: [task('Задание 1'), task('Задание 2')]
	});

async function rows(tx: LimitDb, courseId: string) {
	const topics = await tx
		.select()
		.from(courseTopics)
		.where(eq(courseTopics.courseId, courseId))
		.orderBy(courseTopics.sortOrder);
	const lessons = (
		await tx
			.select({ lesson: courseLessons })
			.from(courseLessons)
			.innerJoin(courseTopics, eq(courseTopics.id, courseLessons.topicId))
			.where(eq(courseLessons.courseId, courseId))
			.orderBy(courseTopics.sortOrder, courseLessons.sortOrder)
	).map((r) => r.lesson);
	const tasks = await tx
		.select()
		.from(practiceTasks)
		.where(eq(practiceTasks.courseId, courseId))
		.orderBy(practiceTasks.sortOrder);
	return { topics, lessons, tasks };
}

describe('training: course content file', () => {
	it('cleans the HTML like the admin forms and refuses an empty lesson', () => {
		const parsed = courseContentSchema(null).parse({
			topics: [
				{
					title: { ru: 'Тема' },
					lessons: [{ title: { ru: 'Урок' }, body: { ru: '<p>Да</p><script>x()</script>' } }]
				}
			],
			practiceTasks: []
		});
		expect(parsed.topics[0].lessons[0].body).toEqual({ ru: '<p>Да</p>' });
		const empty = courseContentSchema(null).safeParse({
			topics: [{ title: { ru: 'Тема' }, lessons: [{ title: { ru: 'Урок' }, body: { ru: '' } }] }],
			practiceTasks: []
		});
		expect(empty.success).toBe(false);
	});
});

describe.skipIf(!testDbUrl)('training: course content import', () => {
	const { inRollback, close } = testDb();
	afterAll(close);

	it('adds draft lessons by topic and visible tasks in file order, all logged', async () => {
		await inRollback(async (tx) => {
			const admin = await staff(tx);
			const course = await insertOpenCourse(tx, { status: 'draft' });
			const title = { en: 'First aid', ru: 'Первая помощь' };
			const made = await createTopic(tx, admin, course.id, { title }, IP);
			if (typeof made === 'string') throw new Error(made);
			const report = await importCourseContent(tx, admin, course.slug, content(), {
				dry: false,
				ip: IP
			});
			expect(report).toMatchObject({
				courseId: course.id,
				topicsCreated: 1,
				lessonsCreated: 3,
				lessonsSkipped: 0,
				tasksCreated: 2,
				tasksSkipped: 0
			});
			const got = await rows(tx, course.id);
			expect(got.topics.map((t) => t.title)).toEqual([title, { ru: '1-й год' }]);
			const year = got.topics[1].id;
			expect(
				got.lessons.map((l) => [l.title, l.topicId, l.sortOrder, l.status, l.createdBy])
			).toEqual([
				[{ ru: 'Курс первой помощи' }, made.id, 0, 'draft', admin.id],
				[{ ru: 'Вводная' }, year, 0, 'draft', admin.id],
				[{ ru: 'Модуль 1' }, year, 1, 'draft', admin.id]
			]);
			expect(got.lessons[1].body).toEqual({ ru: '<h2>Вводная</h2><p>Текст</p>' });
			expect(got.tasks.map((t) => [t.title, t.sortOrder, t.hiddenAt])).toEqual([
				[{ ru: 'Задание 1' }, 0, null],
				[{ ru: 'Задание 2' }, 1, null]
			]);
			expect(got.tasks[0].description).toEqual({ ru: '<p>Задание 1: снять видео</p>' });
			const ids = [...got.lessons, ...got.tasks].map((r) => r.id);
			const audit = await tx
				.select()
				.from(auditLog)
				.where(and(eq(auditLog.actorId, admin.id), inArray(auditLog.entityId, ids)));
			expect(audit.map((e) => e.action).sort()).toEqual([
				'course_lesson.create',
				'course_lesson.create',
				'course_lesson.create',
				'practice_task.create',
				'practice_task.create'
			]);
		});
	});

	it('a repeat adds nothing and keeps the texts edited in the admin', async () => {
		await inRollback(async (tx) => {
			const admin = await staff(tx);
			const course = await insertOpenCourse(tx, { status: 'draft' });
			await importCourseContent(tx, admin, course.slug, content(), { dry: false, ip: IP });
			const edited = { title: { en: 'Intro', ru: 'Вводная' }, body: { ru: '<p>Правка</p>' } };
			const [first] = (await rows(tx, course.id)).lessons;
			await tx.update(courseLessons).set(edited).where(eq(courseLessons.id, first.id));
			await tx
				.update(practiceTasks)
				.set({ hiddenAt: new Date() })
				.where(eq(practiceTasks.courseId, course.id));
			const again = await importCourseContent(tx, admin, course.slug, content(), {
				dry: false,
				ip: IP
			});
			expect(again).toMatchObject({
				topicsCreated: 0,
				lessonsCreated: 0,
				lessonsSkipped: 3,
				tasksCreated: 0,
				tasksSkipped: 2
			});
			const got = await rows(tx, course.id);
			expect(got.topics).toHaveLength(2);
			expect(got.lessons).toHaveLength(3);
			expect(got.lessons[0]).toMatchObject(edited);
			expect(got.tasks).toHaveLength(2);
		});
	});

	it('a dry run reports and writes nothing; no course or not an admin — nothing written', async () => {
		await inRollback(async (tx) => {
			const admin = await staff(tx);
			const course = await insertOpenCourse(tx, { status: 'draft' });
			const dry = await importCourseContent(tx, admin, course.slug, content(), {
				dry: true,
				ip: IP
			});
			expect(dry).toMatchObject({ topicsCreated: 2, lessonsCreated: 3, tasksCreated: 2 });
			const missing = await importCourseContent(tx, admin, 'no-such-course', content(), {
				dry: false,
				ip: IP
			});
			expect(missing).toBe('not_found');
			const editor = await staff(tx, 'editor');
			const refused = await importCourseContent(tx, editor, course.slug, content(), {
				dry: false,
				ip: IP
			});
			expect(refused).toBe('not_allowed');
			const got = await rows(tx, course.id);
			expect([got.topics, got.lessons, got.tasks].map((r) => r.length)).toEqual([0, 0, 0]);
		});
	});
});
