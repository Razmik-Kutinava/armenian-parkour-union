import { and, asc, eq, isNull, sql } from 'drizzle-orm';
import type { LocalizedText } from '#lib/i18n/localized.ts';
import type { LessonValues } from '#lib/validation/training.ts';
import type { LimitDb } from '../../auth/rate-limit';
import { courseLessons, courseTopics } from '../../db/schema/training';
import { isUuid } from '../users/target';

/* docs/05 section 27 "Lessons": by topic order, then the lesson's; lessons without a topic last. */

export type LessonRow = {
	id: string;
	title: LocalizedText;
	topicId: string | null;
	topicTitle: LocalizedText | null;
	topicHidden: boolean;
	sortOrder: number;
	status: LessonValues['status'];
	hasFile: boolean;
};

export async function listLessons(db: LimitDb, courseId: string): Promise<LessonRow[]> {
	if (!isUuid(courseId)) return [];
	const rows = await db
		.select({
			id: courseLessons.id,
			title: courseLessons.title,
			topicId: courseLessons.topicId,
			topicTitle: courseTopics.title,
			topicHiddenAt: courseTopics.hiddenAt,
			sortOrder: courseLessons.sortOrder,
			status: courseLessons.status,
			fileKey: courseLessons.fileKey
		})
		.from(courseLessons)
		.leftJoin(courseTopics, eq(courseTopics.id, courseLessons.topicId))
		.where(and(eq(courseLessons.courseId, courseId), isNull(courseLessons.deletedAt)))
		.orderBy(
			sql`${courseTopics.sortOrder} asc nulls last`,
			asc(courseLessons.sortOrder),
			asc(courseLessons.createdAt)
		);
	return rows.map(({ topicHiddenAt, fileKey, ...r }) => ({
		...r,
		title: r.title as LocalizedText,
		topicTitle: r.topicTitle as LocalizedText | null,
		topicHidden: topicHiddenAt !== null,
		hasFile: fileKey !== null
	}));
}

export type LessonDetail = LessonValues & {
	id: string;
	fileKey: string | null;
	fileName: string | null;
};

export async function getLesson(
	db: LimitDb,
	courseId: string,
	id: string
): Promise<LessonDetail | null> {
	if (!isUuid(courseId) || !isUuid(id)) return null;
	const [row] = await db
		.select()
		.from(courseLessons)
		.where(
			and(
				eq(courseLessons.id, id),
				eq(courseLessons.courseId, courseId),
				isNull(courseLessons.deletedAt)
			)
		);
	if (!row) return null;
	return {
		id: row.id,
		topicId: row.topicId,
		title: row.title as LessonValues['title'],
		body: (row.body ?? {}) as LessonValues['body'],
		sortOrder: row.sortOrder,
		status: row.status,
		fileKey: row.fileKey,
		fileName: row.fileName
	};
}
