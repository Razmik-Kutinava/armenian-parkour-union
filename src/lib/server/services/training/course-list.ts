import { asc, eq, sql } from 'drizzle-orm';
import type { PortalText } from '#lib/i18n/localized.ts';
import type { CourseValues } from '#lib/validation/training.ts';
import type { LimitDb } from '../../auth/rate-limit';
import { courses } from '../../db/schema/training';
import { isUuid } from '../users/target';

/* docs/05 section 27: title, exam kind, status, lessons, questions, tasks, pending requests. */

export type CourseRow = {
	id: string;
	title: PortalText;
	examKind: CourseValues['examKind'];
	status: CourseValues['status'];
	lessons: number;
	questions: number;
	tasks: number;
	pending: number;
};

/* Plain SQL: with one table in FROM, Drizzle drops the table name of columns, and the outer
 * `courses.id` would bind to the inner table. */
const counted = (table: string, where: string) =>
	sql<number>`(select count(*)::int from ${sql.raw(table)} x where x.course_id = courses.id and ${sql.raw(where)})`;

export async function listCourses(db: LimitDb): Promise<CourseRow[]> {
	const rows = await db
		.select({
			id: courses.id,
			title: courses.title,
			examKind: courses.examKind,
			status: courses.status,
			lessons: counted('course_lessons', 'x.deleted_at is null'),
			questions: counted('quiz_questions', 'x.hidden_at is null'),
			tasks: counted('practice_tasks', 'x.hidden_at is null'),
			pending: counted('course_access', `x.status = 'pending'`)
		})
		.from(courses)
		.orderBy(asc(courses.createdAt));
	return rows.map((r) => ({ ...r, title: r.title as PortalText }));
}

export type CourseDetail = CourseValues & { id: string };

export async function getCourse(db: LimitDb, id: string): Promise<CourseDetail | null> {
	if (!isUuid(id)) return null;
	const [row] = await db.select().from(courses).where(eq(courses.id, id));
	if (!row) return null;
	return {
		id: row.id,
		slug: row.slug,
		examKind: row.examKind,
		title: row.title as CourseValues['title'],
		description: row.description as CourseValues['description'],
		status: row.status,
		quizSize: row.quizSize,
		passCount: row.passCount,
		quizMinutes: row.quizMinutes,
		retakeDays: row.retakeDays,
		attemptsLimit: row.attemptsLimit,
		attemptsPeriodDays: row.attemptsPeriodDays,
		requiresMembership: row.requiresMembership,
		minAge: row.minAge,
		requiredLevel: row.requiredLevel
	};
}
