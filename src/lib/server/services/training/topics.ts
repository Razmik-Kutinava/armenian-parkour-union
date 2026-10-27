import { isDeepStrictEqual } from 'node:util';
import { and, asc, eq, sql } from 'drizzle-orm';
import type { TopicValues } from '#lib/validation/training.ts';
import { roleCan } from '../../auth/permissions';
import type { LimitDb } from '../../auth/rate-limit';
import { courses, courseTopics } from '../../db/schema/training';
import { writeAudit } from '../audit';
import { isUuid, type Actor } from '../users/target';

/* docs/05 section 27 "Topics"; decisions — docs/todo.md 9.2 (3, 4). Topics are never deleted. */

type Refusal = 'not_allowed' | 'not_found';
const order = [asc(courseTopics.sortOrder), asc(courseTopics.createdAt), asc(courseTopics.id)];

/** The course row is the lock of its topic order: two moves wait for each other. */
async function lockCourse(tx: LimitDb, courseId: string) {
	if (!isUuid(courseId)) return false;
	const [row] = await tx
		.select({ id: courses.id })
		.from(courses)
		.where(eq(courses.id, courseId))
		.for('update');
	return !!row;
}

async function lockTopic(tx: LimitDb, courseId: string, topicId: string) {
	if (!isUuid(courseId) || !isUuid(topicId)) return null;
	const [row] = await tx
		.select()
		.from(courseTopics)
		.where(and(eq(courseTopics.id, topicId), eq(courseTopics.courseId, courseId)))
		.for('update');
	return row ?? null;
}

const entry = (actor: Actor, action: string, id: string, ip: string | null) => ({
	actorId: actor.id,
	action: `course_topic.${action}`,
	entityType: 'course_topic',
	entityId: id,
	ip
});

export async function listTopics(db: LimitDb, courseId: string) {
	if (!isUuid(courseId)) return [];
	return db
		.select({
			id: courseTopics.id,
			title: courseTopics.title,
			sortOrder: courseTopics.sortOrder,
			hiddenAt: courseTopics.hiddenAt,
			/* Plain SQL: with one table in FROM, Drizzle drops the table name of columns. */
			lessons: sql<number>`(select count(*)::int from course_lessons l
				where l.topic_id = course_topics.id and l.deleted_at is null)`,
			questions: sql<number>`(select count(*)::int from quiz_questions q
				where q.topic_id = course_topics.id and q.hidden_at is null)`
		})
		.from(courseTopics)
		.where(eq(courseTopics.courseId, courseId))
		.orderBy(...order);
}
export type TopicRow = Awaited<ReturnType<typeof listTopics>>[number];

export async function createTopic(
	db: LimitDb,
	actor: Actor,
	courseId: string,
	values: TopicValues,
	ip: string | null
): Promise<{ id: string } | Refusal> {
	if (!roleCan(actor.role, 'training.manage')) return 'not_allowed';
	return db.transaction(async (tx) => {
		if (!(await lockCourse(tx, courseId))) return 'not_found' as const;
		const [{ next }] = await tx
			.select({ next: sql<number>`coalesce(max(${courseTopics.sortOrder}) + 1, 0)::int` })
			.from(courseTopics)
			.where(eq(courseTopics.courseId, courseId));
		const [row] = await tx
			.insert(courseTopics)
			.values({ courseId, title: values.title, sortOrder: next })
			.returning({ id: courseTopics.id });
		await writeAudit(tx, { ...entry(actor, 'create', row.id, ip), after: { courseId, ...values } });
		return { id: row.id };
	});
}

export async function updateTopic(
	db: LimitDb,
	actor: Actor,
	courseId: string,
	topicId: string,
	values: TopicValues,
	ip: string | null
): Promise<'ok' | Refusal> {
	if (!roleCan(actor.role, 'training.manage')) return 'not_allowed';
	return db.transaction(async (tx) => {
		const topic = await lockTopic(tx, courseId, topicId);
		if (!topic) return 'not_found' as const;
		if (isDeepStrictEqual(topic.title, values.title)) return 'ok' as const;
		await tx.update(courseTopics).set({ title: values.title }).where(eq(courseTopics.id, topic.id));
		await writeAudit(tx, {
			...entry(actor, 'update', topic.id, ip),
			before: { title: topic.title },
			after: { title: values.title }
		});
		return 'ok' as const;
	});
}

/** Swaps with the neighbour and numbers the course topics 0…n−1; at the edge nothing changes. */
export async function moveTopic(
	db: LimitDb,
	actor: Actor,
	courseId: string,
	topicId: string,
	direction: 'up' | 'down',
	ip: string | null
): Promise<'ok' | Refusal> {
	if (!roleCan(actor.role, 'training.manage')) return 'not_allowed';
	return db.transaction(async (tx) => {
		if (!(await lockCourse(tx, courseId))) return 'not_found' as const;
		const list = await tx
			.select({ id: courseTopics.id, sortOrder: courseTopics.sortOrder })
			.from(courseTopics)
			.where(eq(courseTopics.courseId, courseId))
			.orderBy(...order);
		const from = list.findIndex((t) => t.id === topicId);
		if (from < 0) return 'not_found' as const;
		const to = direction === 'up' ? from - 1 : from + 1;
		if (to < 0 || to >= list.length) return 'ok' as const;
		[list[from], list[to]] = [list[to], list[from]];
		for (const [n, topic] of list.entries()) {
			if (topic.sortOrder === n) continue;
			await tx.update(courseTopics).set({ sortOrder: n }).where(eq(courseTopics.id, topic.id));
		}
		await writeAudit(tx, {
			...entry(actor, 'reorder', topicId, ip),
			before: { position: from + 1 },
			after: { position: to + 1 }
		});
		return 'ok' as const;
	});
}

export async function setTopicHidden(
	db: LimitDb,
	actor: Actor,
	courseId: string,
	topicId: string,
	hidden: boolean,
	ip: string | null
): Promise<'ok' | 'bad_state' | Refusal> {
	if (!roleCan(actor.role, 'training.manage')) return 'not_allowed';
	return db.transaction(async (tx) => {
		const topic = await lockTopic(tx, courseId, topicId);
		if (!topic) return 'not_found' as const;
		if ((topic.hiddenAt !== null) === hidden) return 'bad_state' as const;
		await tx
			.update(courseTopics)
			.set({ hiddenAt: hidden ? new Date() : null })
			.where(eq(courseTopics.id, topic.id));
		await writeAudit(tx, entry(actor, hidden ? 'hide' : 'restore', topic.id, ip));
		return 'ok' as const;
	});
}
