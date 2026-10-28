import { and, asc, count, desc, eq, ilike, ne, type SQL } from 'drizzle-orm';
import {
	pageOffset,
	PAGE_SIZE,
	type ListOptions,
	type ListState
} from '#lib/components/admin/list-state.ts';
import type { PortalText } from '#lib/i18n/localized.ts';
import type { LimitDb } from '../../auth/rate-limit';
import { courses } from '../../db/schema/training';
import { practiceSubmissions, practiceTasks } from '../../db/schema/training-progress';
import { users } from '../../db/schema/users';
import { isUuid } from '../users/target';
import { taskOrder } from './practice-task-list';

/* docs/05 section 27 "Practice" (moderator, admin): the queue and the card. Decisions —
 * docs/todo.md 9.7 (6). */

export const practiceListOptions: ListOptions = {
	sortable: [],
	filters: ['status', 'course', 'task'],
	defaultSort: { key: 'date', dir: 'asc' }
};

export const practiceStatuses = ['pending', 'approved', 'rejected'] as const;
export type PracticeFilter = {
	status: (typeof practiceStatuses)[number] | 'all';
	courseId: string | null;
	taskId: string | null;
	page: number;
	/** Part of the member name. */
	q?: string;
};

const uuidOrNull = (v: string | undefined) => (v && isUuid(v) ? v : null);

/** Unknown status — the queue itself; ids only if they are uuids. */
export const practiceFilter = (state: ListState): PracticeFilter => ({
	status:
		state.filters.status === 'all'
			? 'all'
			: (practiceStatuses.find((s) => s === state.filters.status) ?? 'pending'),
	courseId: uuidOrNull(state.filters.course),
	taskId: uuidOrNull(state.filters.task),
	page: state.page,
	q: state.q
});

const escapeLike = (v: string) => v.replace(/[\\%_]/g, (c) => `\\${c}`);

const s = practiceSubmissions;
const columns = {
	id: s.id,
	userId: s.userId,
	name: users.name,
	courseId: practiceTasks.courseId,
	courseTitle: courses.title,
	taskId: s.taskId,
	taskTitle: practiceTasks.title,
	url: s.url,
	platform: s.platform,
	status: s.status,
	note: s.reviewNote,
	date: s.createdAt
};
const typed = <T extends { courseTitle: unknown; taskTitle: unknown }>(r: T) => ({
	...r,
	courseTitle: r.courseTitle as PortalText,
	taskTitle: r.taskTitle as PortalText
});

const joined = (db: LimitDb, where: SQL | undefined) =>
	db
		.select(columns)
		.from(s)
		.innerJoin(practiceTasks, eq(practiceTasks.id, s.taskId))
		.innerJoin(courses, eq(courses.id, practiceTasks.courseId))
		.innerJoin(users, eq(users.id, s.userId))
		.where(where);

export async function listPractice(db: LimitDb, filter: PracticeFilter) {
	const where = and(
		filter.status === 'all' ? undefined : eq(s.status, filter.status),
		filter.courseId ? eq(practiceTasks.courseId, filter.courseId) : undefined,
		filter.taskId ? eq(s.taskId, filter.taskId) : undefined,
		filter.q ? ilike(users.name, `%${escapeLike(filter.q)}%`) : undefined
	);
	const [rows, [{ total }]] = await Promise.all([
		joined(db, where)
			.orderBy(asc(s.createdAt), asc(s.id))
			.limit(PAGE_SIZE)
			.offset(pageOffset(filter.page)),
		db
			.select({ total: count() })
			.from(s)
			.innerJoin(practiceTasks, eq(practiceTasks.id, s.taskId))
			.innerJoin(users, eq(users.id, s.userId))
			.where(where)
	]);
	return { rows: rows.map(typed), total };
}
export type PracticeRow = Awaited<ReturnType<typeof listPractice>>['rows'][number];

/** The card: the task text and this member's earlier submissions on the task, newest first. */
export async function practiceDetail(db: LimitDb, id: string, viewerId: string) {
	if (!isUuid(id)) return null;
	const [row] = await joined(db, eq(s.id, id));
	if (!row) return null;
	const [task] = await db
		.select({ description: practiceTasks.description })
		.from(practiceTasks)
		.where(eq(practiceTasks.id, row.taskId));
	const history = await db
		.select({ id: s.id, url: s.url, status: s.status, note: s.reviewNote, date: s.createdAt })
		.from(s)
		.where(and(eq(s.taskId, row.taskId), eq(s.userId, row.userId), ne(s.id, id)))
		.orderBy(desc(s.createdAt), desc(s.id));
	const { taskId, taskTitle, ...rest } = typed(row);
	return {
		...rest,
		own: row.userId === viewerId,
		task: {
			id: taskId,
			title: taskTitle,
			description: task.description as PortalText
		},
		history
	};
}
export type PracticeCard = NonNullable<Awaited<ReturnType<typeof practiceDetail>>>;

/** Course and task choices of the filters. */
export async function practiceChoices(db: LimitDb) {
	const rows = await db
		.select({ id: practiceTasks.id, title: practiceTasks.title, courseTitle: courses.title })
		.from(practiceTasks)
		.innerJoin(courses, eq(courses.id, practiceTasks.courseId))
		.orderBy(asc(courses.createdAt), ...taskOrder);
	return rows.map((r) => ({
		id: r.id,
		title: r.title as PortalText,
		courseTitle: r.courseTitle as PortalText
	}));
}
