import { and, asc, count, eq, isNull } from 'drizzle-orm';
import type { PortalText } from '#lib/i18n/localized.ts';
import type { QuestionValues } from '#lib/validation/training-questions.ts';
import type { LimitDb } from '../../auth/rate-limit';
import { courses, courseTopics, quizQuestions } from '../../db/schema/training';
import { isUuid } from '../users/target';

/* docs/05 section 27 "Question bank"; decisions — docs/todo.md 9.3 (6). A bank is hundreds of
 * rows: the whole course is read, filters and search work in memory and keep the numbers. */

export type QuestionFilter = {
	topicId?: string | null;
	state?: 'all' | 'visible' | 'hidden';
	q?: string;
};

export type QuestionRow = {
	id: string;
	number: number;
	topicId: string;
	topicTitle: PortalText;
	topicHidden: boolean;
	text: PortalText;
	correct: PortalText;
	source: string | null;
	hidden: boolean;
};

/** Visible questions of visible topics against the quiz; the even share of one topic. */
export type BankStats = {
	quizSize: number;
	visible: number;
	perTopic: number;
	inTopic: number | null;
};

const matches = (row: QuestionRow, filter: QuestionFilter, needle: string) =>
	(!filter.topicId || row.topicId === filter.topicId) &&
	(filter.state === 'hidden' ? row.hidden : filter.state === 'visible' ? !row.hidden : true) &&
	(!needle || Object.values(row.text).some((s) => s?.toLocaleLowerCase().includes(needle)));

export async function listQuestions(db: LimitDb, courseId: string, filter: QuestionFilter) {
	if (!isUuid(courseId)) return null;
	const [course] = await db
		.select({ quizSize: courses.quizSize })
		.from(courses)
		.where(eq(courses.id, courseId));
	if (!course) return null;
	const all = await db
		.select({
			q: quizQuestions,
			topicTitle: courseTopics.title,
			topicHiddenAt: courseTopics.hiddenAt
		})
		.from(quizQuestions)
		.innerJoin(courseTopics, eq(courseTopics.id, quizQuestions.topicId))
		.where(eq(quizQuestions.courseId, courseId))
		.orderBy(
			asc(courseTopics.sortOrder),
			asc(courseTopics.createdAt),
			asc(courseTopics.id),
			asc(quizQuestions.createdAt),
			asc(quizQuestions.id)
		);
	const rows: QuestionRow[] = all.map(({ q, topicTitle, topicHiddenAt }, i) => ({
		id: q.id,
		number: i + 1,
		topicId: q.topicId,
		topicTitle: topicTitle as PortalText,
		topicHidden: topicHiddenAt !== null,
		text: q.text as PortalText,
		correct: (q.options as PortalText[])[q.correctIndex] ?? {},
		source: q.source,
		hidden: q.hiddenAt !== null
	}));
	const [{ topics }] = await db
		.select({ topics: count() })
		.from(courseTopics)
		.where(and(eq(courseTopics.courseId, courseId), isNull(courseTopics.hiddenAt)));
	const live = rows.filter((r) => !r.hidden && !r.topicHidden);
	const stats: BankStats = {
		quizSize: course.quizSize,
		visible: live.length,
		perTopic: topics ? Math.ceil(course.quizSize / topics) : 0,
		inTopic: filter.topicId ? live.filter((r) => r.topicId === filter.topicId).length : null
	};
	const needle = filter.q?.trim().toLocaleLowerCase() ?? '';
	return { rows: rows.filter((r) => matches(r, filter, needle)), stats };
}

export type QuestionDetail = QuestionValues & { id: string; hiddenAt: Date | null };

export async function getQuestion(
	db: LimitDb,
	courseId: string,
	id: string
): Promise<QuestionDetail | null> {
	if (!isUuid(courseId) || !isUuid(id)) return null;
	const [row] = await db
		.select()
		.from(quizQuestions)
		.where(and(eq(quizQuestions.id, id), eq(quizQuestions.courseId, courseId)));
	if (!row) return null;
	return {
		id: row.id,
		topicId: row.topicId,
		text: row.text as PortalText,
		options: row.options as PortalText[],
		correctIndex: row.correctIndex,
		source: row.source,
		hiddenAt: row.hiddenAt
	};
}
