import { and, asc, eq, sql } from 'drizzle-orm';
import type { PortalText } from '#lib/i18n/localized.ts';
import type { LimitDb } from '../../auth/rate-limit';
import { practiceTasks } from '../../db/schema/training-progress';
import { isUuid } from '../users/target';

/* docs/05 section 27 "Practice tasks": reads of the admin tab. */

export const taskOrder = [
	asc(practiceTasks.sortOrder),
	asc(practiceTasks.createdAt),
	asc(practiceTasks.id)
];

export async function listTasks(db: LimitDb, courseId: string) {
	if (!isUuid(courseId)) return [];
	const rows = await db
		.select({
			id: practiceTasks.id,
			title: practiceTasks.title,
			sortOrder: practiceTasks.sortOrder,
			hiddenAt: practiceTasks.hiddenAt,
			/* Plain SQL: with one table in FROM, Drizzle drops the table name of columns. */
			pending: sql<number>`(select count(*)::int from practice_submissions s
				where s.task_id = practice_tasks.id and s.status = 'pending')`,
			accepted: sql<number>`(select count(*)::int from practice_submissions s
				where s.task_id = practice_tasks.id and s.status = 'approved')`
		})
		.from(practiceTasks)
		.where(eq(practiceTasks.courseId, courseId))
		.orderBy(...taskOrder);
	return rows.map((r) => ({ ...r, title: r.title as PortalText }));
}
export type TaskRow = Awaited<ReturnType<typeof listTasks>>[number];

export async function getTask(db: LimitDb, courseId: string, taskId: string) {
	if (!isUuid(courseId) || !isUuid(taskId)) return null;
	const [row] = await db
		.select()
		.from(practiceTasks)
		.where(and(eq(practiceTasks.id, taskId), eq(practiceTasks.courseId, courseId)));
	if (!row) return null;
	return {
		...row,
		title: row.title as PortalText,
		description: row.description as Record<string, string>
	};
}
export type TaskDetail = NonNullable<Awaited<ReturnType<typeof getTask>>>;
