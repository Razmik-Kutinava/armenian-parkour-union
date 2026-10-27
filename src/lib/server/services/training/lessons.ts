import { isDeepStrictEqual } from 'node:util';
import { and, eq, isNull } from 'drizzle-orm';
import type { LessonValues } from '#lib/validation/training.ts';
import { roleCan } from '../../auth/permissions';
import type { LimitDb } from '../../auth/rate-limit';
import { courses, courseLessons, courseTopics } from '../../db/schema/training';
import { writeAudit } from '../audit';
import { lockPageMedia } from '../pages/media';
import { isUuid, type Actor } from '../users/target';

/* docs/05 section 27 "Lessons"; decisions — docs/todo.md 9.2 (3, 5). Delete is soft. */

type Refusal = 'not_allowed' | 'not_found' | 'bad_topic';
const LOGGED = ['title', 'topicId', 'sortOrder', 'status'] as const;

/** A topic of this course; a hidden one is allowed — material is prepared in advance. */
export async function topicFits(tx: LimitDb, courseId: string, topicId: string | null) {
	if (topicId === null) return true;
	const [row] = await tx
		.select({ id: courseTopics.id })
		.from(courseTopics)
		.where(and(eq(courseTopics.id, topicId), eq(courseTopics.courseId, courseId)));
	return !!row;
}

/** A lesson of this course that is not deleted, locked for the change. */
export async function lockLesson(tx: LimitDb, courseId: string, id: string) {
	if (!isUuid(courseId) || !isUuid(id)) return null;
	const [row] = await tx
		.select()
		.from(courseLessons)
		.where(
			and(
				eq(courseLessons.id, id),
				eq(courseLessons.courseId, courseId),
				isNull(courseLessons.deletedAt)
			)
		)
		.for('update');
	return row ?? null;
}

const entry = (actor: Actor, action: string, id: string, ip: string | null) => ({
	actorId: actor.id,
	action: `course_lesson.${action}`,
	entityType: 'course_lesson',
	entityId: id,
	ip
});

export async function createLesson(
	db: LimitDb,
	actor: Actor,
	courseId: string,
	values: LessonValues,
	ip: string | null
): Promise<{ id: string } | Refusal> {
	if (!roleCan(actor.role, 'training.lessons')) return 'not_allowed';
	if (!isUuid(courseId)) return 'not_found';
	return db.transaction(async (tx) => {
		const [course] = await tx
			.select({ id: courses.id })
			.from(courses)
			.where(eq(courses.id, courseId));
		if (!course) return 'not_found' as const;
		if (!(await topicFits(tx, courseId, values.topicId))) return 'bad_topic' as const;
		await lockPageMedia(tx, values.body);
		const [row] = await tx
			.insert(courseLessons)
			.values({ ...values, courseId, createdBy: actor.id })
			.returning({ id: courseLessons.id });
		const { title, topicId, sortOrder, status } = values;
		await writeAudit(tx, {
			...entry(actor, 'create', row.id, ip),
			after: { courseId, title, topicId, sortOrder, status }
		});
		return { id: row.id };
	});
}

export async function updateLesson(
	db: LimitDb,
	actor: Actor,
	courseId: string,
	id: string,
	values: LessonValues,
	ip: string | null
): Promise<'ok' | Refusal> {
	if (!roleCan(actor.role, 'training.lessons')) return 'not_allowed';
	return db.transaction(async (tx) => {
		const lesson = await lockLesson(tx, courseId, id);
		if (!lesson) return 'not_found' as const;
		if (!(await topicFits(tx, courseId, values.topicId))) return 'bad_topic' as const;
		const before: Record<string, unknown> = {};
		const after: Record<string, unknown> = {};
		for (const key of LOGGED) {
			if (isDeepStrictEqual(lesson[key], values[key])) continue;
			before[key] = lesson[key];
			after[key] = values[key];
		}
		const bodyChanged = !isDeepStrictEqual(lesson.body ?? {}, values.body);
		if (!bodyChanged && Object.keys(after).length === 0) return 'ok' as const;
		await lockPageMedia(tx, values.body);
		await tx.update(courseLessons).set(values).where(eq(courseLessons.id, lesson.id));
		await writeAudit(tx, {
			...entry(actor, 'update', lesson.id, ip),
			before,
			after: bodyChanged ? { ...after, bodyChanged: true } : after
		});
		return 'ok' as const;
	});
}

export async function deleteLesson(
	db: LimitDb,
	actor: Actor,
	courseId: string,
	id: string,
	ip: string | null
): Promise<'ok' | Exclude<Refusal, 'bad_topic'>> {
	if (!roleCan(actor.role, 'training.lessons')) return 'not_allowed';
	return db.transaction(async (tx) => {
		const lesson = await lockLesson(tx, courseId, id);
		if (!lesson) return 'not_found' as const;
		await tx
			.update(courseLessons)
			.set({ deletedAt: new Date() })
			.where(eq(courseLessons.id, lesson.id));
		await writeAudit(tx, {
			...entry(actor, 'delete', lesson.id, ip),
			before: { title: lesson.title }
		});
		return 'ok' as const;
	});
}
