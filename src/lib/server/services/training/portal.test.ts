import { eq } from 'drizzle-orm';
import { afterAll, describe, expect, it } from 'vitest';
import type { LimitDb } from '../../auth/rate-limit';
import { exams } from '../../db/schema/certification';
import { courseLessons, courses, courseTopics } from '../../db/schema/training';
import { courseAccess } from '../../db/schema/training-progress';
import { users } from '../../db/schema/users';
import { testDb, testDbUrl } from '../../db/test-db';
import { portalLesson, portalLessonPdfKey, portalOverview } from './portal';
import { applicant, insertOpenCourse, insertTopic, staff } from './test-support';

/* docs/03 sections 18.1 p. 4–5, 18.2; docs/06 section 5.11 "Portal"; decisions — docs/todo.md 9.5. */

type Status = 'pending' | 'approved' | 'rejected' | 'revoked';

async function grant(tx: LimitDb, courseId: string, userId: string, status: Status = 'approved') {
	const decided = status === 'pending' ? {} : { reviewedAt: new Date() };
	const note = status === 'rejected' || status === 'revoked' ? { reviewNote: 'Причина' } : {};
	await tx.insert(courseAccess).values({ courseId, userId, status, ...decided, ...note });
}

async function lesson(
	tx: LimitDb,
	courseId: string,
	topicId: string | null,
	extra: Partial<typeof courseLessons.$inferInsert> = {}
) {
	const [row] = await tx
		.insert(courseLessons)
		.values({
			courseId,
			topicId,
			title: { ru: `Урок ${crypto.randomUUID().slice(0, 4)}` },
			body: { ru: '<p>Текст</p>', en: '<p>Text</p>' },
			status: 'published',
			...extra
		})
		.returning({ id: courseLessons.id });
	return row.id;
}

const member = async (tx: LimitDb, extra: Parameters<typeof applicant>[1] = {}) => {
	const user = await applicant(tx, extra);
	return { id: user.id, role: 'member' as const };
};

describe.skipIf(!testDbUrl)('training portal: lessons by topic', () => {
	const { inRollback, close } = testDb();
	afterAll(close);

	it('an approved member: visible topics in order, published lessons in order, no-topic last', async () => {
		await inRollback(async (tx) => {
			const course = await insertOpenCourse(tx);
			const second = await insertTopic(tx, course.id, 1);
			const first = await insertTopic(tx, course.id, 0);
			const hidden = await insertTopic(tx, course.id, 2);
			const empty = await insertTopic(tx, course.id, 3);
			await tx
				.update(courseTopics)
				.set({ hiddenAt: new Date() })
				.where(eq(courseTopics.id, hidden));
			const b = await lesson(tx, course.id, first, { sortOrder: 1 });
			const a = await lesson(tx, course.id, first, {
				sortOrder: 0,
				fileKey: 'k',
				fileName: 'a.pdf'
			});
			const c = await lesson(tx, course.id, second);
			const loose = await lesson(tx, course.id, null);
			await lesson(tx, course.id, hidden);
			await lesson(tx, course.id, empty, { status: 'draft' });
			await lesson(tx, course.id, first, { status: 'archived' });
			await lesson(tx, course.id, second, { deletedAt: new Date() });
			const user = await member(tx);
			await grant(tx, course.id, user.id);

			const portal = await portalOverview(tx, user, course.slug);
			expect(portal?.preview).toBe(false);
			expect(portal?.course).toMatchObject({ id: course.id, slug: course.slug });
			expect(portal?.topics.map((t) => t.id)).toEqual([first, second, null]);
			expect(portal?.topics[0].lessons.map((l) => l.id)).toEqual([a, b]);
			expect(portal?.topics[0].lessons[0].hasFile).toBe(true);
			expect(portal?.topics[1].lessons.map((l) => l.id)).toEqual([c]);
			expect(portal?.topics[2]).toMatchObject({ title: null, lessons: [{ id: loose }] });
		});
	});

	it('a finished course stays open', async () => {
		await inRollback(async (tx) => {
			const course = await insertOpenCourse(tx);
			const user = await member(tx);
			await grant(tx, course.id, user.id);
			const [exam] = await tx
				.insert(exams)
				.values({ userId: user.id, kind: 'trainer', result: 'passed', decidedAt: new Date() })
				.returning({ id: exams.id });
			await tx
				.update(courseAccess)
				.set({ examId: exam.id })
				.where(eq(courseAccess.userId, user.id));
			expect(await portalOverview(tx, user, course.slug)).not.toBeNull();
		});
	});

	it('closed: no request, pending, rejected, revoked, another member’s approval', async () => {
		await inRollback(async (tx) => {
			const course = await insertOpenCourse(tx);
			const nobody = await member(tx);
			expect(await portalOverview(tx, nobody, course.slug)).toBeNull();
			for (const status of ['pending', 'rejected', 'revoked'] as const) {
				const user = await member(tx);
				await grant(tx, course.id, user.id, status);
				expect(await portalOverview(tx, user, course.slug)).toBeNull();
			}
			const other = await member(tx);
			await grant(tx, course.id, other.id);
			expect(await portalOverview(tx, nobody, course.slug)).toBeNull();
		});
	});

	it('closed for a member: course not published, blocked or deleted member, unknown slug', async () => {
		await inRollback(async (tx) => {
			for (const status of ['draft', 'archived'] as const) {
				const course = await insertOpenCourse(tx, { status });
				const user = await member(tx);
				await grant(tx, course.id, user.id);
				expect(await portalOverview(tx, user, course.slug)).toBeNull();
			}
			const course = await insertOpenCourse(tx);
			const blocked = await member(tx);
			const deleted = await member(tx);
			await grant(tx, course.id, blocked.id);
			await grant(tx, course.id, deleted.id);
			await tx.update(users).set({ status: 'blocked' }).where(eq(users.id, blocked.id));
			await tx.update(users).set({ deletedAt: new Date() }).where(eq(users.id, deleted.id));
			expect(await portalOverview(tx, blocked, course.slug)).toBeNull();
			expect(await portalOverview(tx, deleted, course.slug)).toBeNull();
			expect(await portalOverview(tx, blocked, 'no-such-course')).toBeNull();
		});
	});

	it('preview: admin without a request sees any course; editor and moderator do not', async () => {
		await inRollback(async (tx) => {
			const course = await insertOpenCourse(tx, { status: 'draft' });
			const topic = await insertTopic(tx, course.id);
			const shown = await lesson(tx, course.id, topic);
			await lesson(tx, course.id, topic, { status: 'draft' });
			const admin = await staff(tx, 'admin');
			const portal = await portalOverview(tx, admin, course.slug);
			expect(portal?.preview).toBe(true);
			expect(portal?.topics.flatMap((t) => t.lessons.map((l) => l.id))).toEqual([shown]);
			expect(await portalLesson(tx, admin, course.slug, shown)).not.toBeNull();
			for (const role of ['editor', 'moderator'] as const) {
				const actor = await staff(tx, role);
				expect(await portalOverview(tx, actor, course.slug)).toBeNull();
				expect(await portalLesson(tx, actor, course.slug, shown)).toBeNull();
			}
		});
	});
});

describe.skipIf(!testDbUrl)('training portal: one lesson and its PDF', () => {
	const { inRollback, close } = testDb();
	afterAll(close);

	it('a visible lesson: title, text per language, topic, file name and key', async () => {
		await inRollback(async (tx) => {
			const course = await insertOpenCourse(tx);
			const topic = await insertTopic(tx, course.id);
			const key = `training/${course.id}/${crypto.randomUUID()}.pdf`;
			const id = await lesson(tx, course.id, topic, { fileKey: key, fileName: 'Урок 1.pdf' });
			const user = await member(tx);
			await grant(tx, course.id, user.id);
			const found = await portalLesson(tx, user, course.slug, id);
			expect(found?.preview).toBe(false);
			expect(found?.lesson).toMatchObject({
				id,
				body: { ru: '<p>Текст</p>', en: '<p>Text</p>' },
				topicTitle: { en: 'Topic 0' },
				fileName: 'Урок 1.pdf'
			});
			expect(found?.lesson).not.toHaveProperty('fileKey');
			expect(await portalLessonPdfKey(tx, user, course.slug, id)).toBe(key);
		});
	});

	it('hidden lessons and swapped ids: null, no key', async () => {
		await inRollback(async (tx) => {
			const course = await insertOpenCourse(tx);
			const otherCourse = await insertOpenCourse(tx);
			const topic = await insertTopic(tx, course.id);
			const hiddenTopic = await insertTopic(tx, course.id, 1);
			await tx
				.update(courseTopics)
				.set({ hiddenAt: new Date() })
				.where(eq(courseTopics.id, hiddenTopic));
			const file = { fileKey: 'training/x.pdf', fileName: 'x.pdf' };
			const ids = [
				await lesson(tx, course.id, topic, { ...file, status: 'draft' }),
				await lesson(tx, course.id, topic, { ...file, deletedAt: new Date() }),
				await lesson(tx, course.id, hiddenTopic, file),
				await lesson(tx, otherCourse.id, null, file)
			];
			const user = await member(tx);
			await grant(tx, course.id, user.id);
			for (const id of [...ids, crypto.randomUUID(), 'nope']) {
				expect(await portalLesson(tx, user, course.slug, id)).toBeNull();
				expect(await portalLessonPdfKey(tx, user, course.slug, id)).toBeNull();
			}
		});
	});

	it('no access — no lesson and no key; a lesson without a file — no key', async () => {
		await inRollback(async (tx) => {
			const course = await insertOpenCourse(tx);
			const withFile = await lesson(tx, course.id, null, {
				fileKey: 'training/y.pdf',
				fileName: 'y.pdf'
			});
			const noFile = await lesson(tx, course.id, null);
			const outsider = await member(tx);
			await grant(tx, course.id, outsider.id, 'pending');
			expect(await portalLesson(tx, outsider, course.slug, withFile)).toBeNull();
			expect(await portalLessonPdfKey(tx, outsider, course.slug, withFile)).toBeNull();
			const user = await member(tx);
			await grant(tx, course.id, user.id);
			expect(await portalLessonPdfKey(tx, user, course.slug, noFile)).toBeNull();
			const admin = await staff(tx, 'admin');
			expect(await portalLessonPdfKey(tx, admin, course.slug, withFile)).toBe('training/y.pdf');
		});
	});

	it('the course slug decides: a lesson of a course the member can open, under another slug — null', async () => {
		await inRollback(async (tx) => {
			const open = await insertOpenCourse(tx);
			const closed = await insertOpenCourse(tx);
			const id = await lesson(tx, closed.id, null, {
				fileKey: 'training/z.pdf',
				fileName: 'z.pdf'
			});
			const user = await member(tx);
			await grant(tx, open.id, user.id);
			expect(await portalLesson(tx, user, open.slug, id)).toBeNull();
			expect(await portalLessonPdfKey(tx, user, open.slug, id)).toBeNull();
			const [row] = await tx.select().from(courses).where(eq(courses.id, closed.id));
			expect(await portalLesson(tx, user, row.slug, id)).toBeNull();
		});
	});
});
