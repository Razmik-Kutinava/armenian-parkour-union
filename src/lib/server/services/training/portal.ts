import { and, asc, eq, isNull, sql } from 'drizzle-orm';
import type { PortalText } from '#lib/i18n/localized.ts';
import type { LimitDb } from '../../auth/rate-limit';
import { courseLessons, courseTopics } from '../../db/schema/training';
import { isUuid, type Actor } from '../users/target';
import { openPortal, type PortalGate } from './portal-gate';

/* docs/03 section 18.2: published lessons of visible topics, by topic order, then the lesson's;
 * lessons without a topic last. Decisions — docs/todo.md 9.5 (2–3). */

export type PortalLessonLink = { id: string; title: PortalText; hasFile: boolean };
export type PortalTopic = {
	id: string | null;
	title: PortalText | null;
	lessons: PortalLessonLink[];
};
export type PortalLesson = {
	id: string;
	title: PortalText;
	body: PortalText;
	topicTitle: PortalText | null;
	fileName: string | null;
};

const visible = (courseId: string) =>
	and(
		eq(courseLessons.courseId, courseId),
		eq(courseLessons.status, 'published'),
		isNull(courseLessons.deletedAt),
		isNull(courseTopics.hiddenAt)
	);

export async function portalOverview(
	db: LimitDb,
	viewer: Actor,
	slug: string
): Promise<(PortalGate & { topics: PortalTopic[] }) | null> {
	const gate = await openPortal(db, viewer, slug);
	if (!gate) return null;
	const rows = await db
		.select({
			id: courseLessons.id,
			title: courseLessons.title,
			fileKey: courseLessons.fileKey,
			topicId: courseLessons.topicId,
			topicTitle: courseTopics.title
		})
		.from(courseLessons)
		.leftJoin(courseTopics, eq(courseTopics.id, courseLessons.topicId))
		.where(visible(gate.course.id))
		.orderBy(
			sql`${courseTopics.sortOrder} asc nulls last`,
			asc(courseTopics.id),
			asc(courseLessons.sortOrder),
			asc(courseLessons.createdAt)
		);
	const topics: PortalTopic[] = [];
	for (const row of rows) {
		let topic = topics.at(-1);
		if (!topic || topic.id !== row.topicId) {
			topic = { id: row.topicId, title: row.topicTitle as PortalText | null, lessons: [] };
			topics.push(topic);
		}
		topic.lessons.push({
			id: row.id,
			title: row.title as PortalText,
			hasFile: row.fileKey !== null
		});
	}
	return { ...gate, topics };
}

async function visibleLesson(db: LimitDb, viewer: Actor, slug: string, lessonId: string) {
	if (!isUuid(lessonId)) return null;
	const gate = await openPortal(db, viewer, slug);
	if (!gate) return null;
	const [row] = await db
		.select({ lesson: courseLessons, topicTitle: courseTopics.title })
		.from(courseLessons)
		.leftJoin(courseTopics, eq(courseTopics.id, courseLessons.topicId))
		.where(and(eq(courseLessons.id, lessonId), visible(gate.course.id)));
	return row ? { gate, ...row } : null;
}

export async function portalLesson(
	db: LimitDb,
	viewer: Actor,
	slug: string,
	lessonId: string
): Promise<(PortalGate & { lesson: PortalLesson }) | null> {
	const found = await visibleLesson(db, viewer, slug, lessonId);
	if (!found) return null;
	const { lesson, topicTitle, gate } = found;
	return {
		...gate,
		lesson: {
			id: lesson.id,
			title: lesson.title as PortalText,
			body: (lesson.body ?? {}) as PortalText,
			topicTitle: topicTitle as PortalText | null,
			fileName: lesson.fileName
		}
	};
}

/** The private-bucket key, checked on the click: the signed link is made right before the redirect. */
export async function portalLessonPdfKey(
	db: LimitDb,
	viewer: Actor,
	slug: string,
	lessonId: string
): Promise<string | null> {
	return (await visibleLesson(db, viewer, slug, lessonId))?.lesson.fileKey ?? null;
}
