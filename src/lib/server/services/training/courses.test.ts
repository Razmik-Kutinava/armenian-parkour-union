import { eq } from 'drizzle-orm';
import { afterAll, describe, expect, it } from 'vitest';
import type { LimitDb } from '../../auth/rate-limit';
import type { UserRole } from '../../auth/session';
import { courseLessons, quizQuestions } from '../../db/schema/training';
import { courseAccess } from '../../db/schema/training-progress';
import { insertUser, testDb, testDbUrl } from '../../db/test-db';
import { getCourse, listCourses } from './course-list';
import { createCourse, updateCourse } from './courses';
import { auditOf, courseValues, insertTopic, IP, staff } from './test-support';

/* docs/05 section 27 "Courses", docs/03 section 18.6; decisions — docs/todo.md 9.2 (1–3). */

async function created(tx: LimitDb, actor: { id: string; role: UserRole }, slug?: string) {
	const result = await createCourse(tx, actor, courseValues(slug ? { slug } : {}), IP);
	if (typeof result === 'string') throw new Error(result);
	return result.id;
}

describe.skipIf(!testDbUrl)('training: courses in the admin', () => {
	const { inRollback, close } = testDb();
	afterAll(close);

	it('an admin creates a course with its settings; it is logged', async () => {
		await inRollback(async (tx) => {
			const admin = await staff(tx);
			const v = courseValues();
			const result = await createCourse(tx, admin, v, IP);
			if (typeof result === 'string') throw new Error(result);
			expect(await getCourse(tx, result.id)).toMatchObject({ ...v, id: result.id });
			const [entry] = await auditOf(tx, 'course', result.id);
			expect(entry).toMatchObject({ action: 'course.create', actorId: admin.id, ip: IP });
			expect(entry.after).toMatchObject({ slug: v.slug, passCount: 25, minAge: 18 });
		});
	});

	it('only an admin creates or edits a course', async () => {
		await inRollback(async (tx) => {
			const id = await created(tx, await staff(tx));
			for (const role of ['editor', 'moderator', 'member'] as const) {
				const actor = await staff(tx, role);
				expect(await createCourse(tx, actor, courseValues(), IP)).toBe('not_allowed');
				expect(await updateCourse(tx, actor, id, courseValues(), IP)).toBe('not_allowed');
			}
		});
	});

	it('the address is unique', async () => {
		await inRollback(async (tx) => {
			const admin = await staff(tx);
			const slug = `t-course-${crypto.randomUUID().slice(0, 8)}`;
			await created(tx, admin, slug);
			expect(await createCourse(tx, admin, courseValues({ slug }), IP)).toBe('slug_taken');
			const other = await created(tx, admin);
			expect(await updateCourse(tx, admin, other, courseValues({ slug }), IP)).toBe('slug_taken');
		});
	});

	it('a settings change logs only the changed fields; an unchanged save logs nothing', async () => {
		await inRollback(async (tx) => {
			const admin = await staff(tx);
			const v = courseValues();
			const result = await createCourse(tx, admin, v, IP);
			if (typeof result === 'string') throw new Error(result);
			expect(await updateCourse(tx, admin, result.id, v, IP)).toBe('ok');
			const next = { ...v, passCount: 24, minAge: null, requiredLevel: null };
			expect(await updateCourse(tx, admin, result.id, next, IP)).toBe('ok');
			expect(await getCourse(tx, result.id)).toMatchObject(next);
			const entries = await auditOf(tx, 'course', result.id);
			expect(entries.map((e) => e.action)).toEqual(['course.create', 'course.update']);
			expect(entries[1].before).toEqual({ passCount: 25, minAge: 18, requiredLevel: 'advanced' });
			expect(entries[1].after).toEqual({ passCount: 24, minAge: null, requiredLevel: null });
		});
	});

	it('an unknown course is not found', async () => {
		await inRollback(async (tx) => {
			const admin = await staff(tx);
			expect(await updateCourse(tx, admin, crypto.randomUUID(), courseValues(), IP)).toBe(
				'not_found'
			);
			expect(await updateCourse(tx, admin, 'nope', courseValues(), IP)).toBe('not_found');
			expect(await getCourse(tx, 'nope')).toBeNull();
		});
	});

	it('the list counts lessons, visible questions and pending requests', async () => {
		await inRollback(async (tx) => {
			const admin = await staff(tx);
			const id = await created(tx, admin);
			const topic = await insertTopic(tx, id);
			await tx.insert(courseLessons).values([
				{ courseId: id, title: { en: 'A' } },
				{ courseId: id, title: { en: 'B' }, deletedAt: new Date() }
			]);
			const question = { courseId: id, topicId: topic, text: { en: 'Q' }, correctIndex: 0 };
			const options = [{ en: 'Yes' }, { en: 'No' }];
			await tx.insert(quizQuestions).values([
				{ ...question, options },
				{ ...question, options, hiddenAt: new Date() }
			]);
			const member = await insertUser(tx);
			await tx.insert(courseAccess).values({ courseId: id, userId: member.id });
			const row = (await listCourses(tx)).find((c) => c.id === id);
			expect(row).toMatchObject({ lessons: 1, questions: 1, tasks: 0, pending: 1 });
			await tx
				.update(courseAccess)
				.set({ status: 'approved', reviewedAt: new Date() })
				.where(eq(courseAccess.courseId, id));
			expect((await listCourses(tx)).find((c) => c.id === id)?.pending).toBe(0);
		});
	});
});
