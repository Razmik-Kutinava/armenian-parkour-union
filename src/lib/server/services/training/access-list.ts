import { and, asc, count, eq, ilike, sql, type SQL } from 'drizzle-orm';
import {
	pageOffset,
	PAGE_SIZE,
	type ListOptions,
	type ListState
} from '#lib/components/admin/list-state.ts';
import type { PortalText } from '#lib/i18n/localized.ts';
import { ageOn } from '#lib/validation/auth.ts';
import type { LimitDb } from '../../auth/rate-limit';
import { courses } from '../../db/schema/training';
import { courseAccess } from '../../db/schema/training-progress';
import { users } from '../../db/schema/users';
import { isUuid } from '../users/target';

/* docs/05 section 27 "Requests" (admin, contacts included — docs/04 section 4); decisions —
 * docs/todo.md 9.4 (5). The date is the last change: a new request or a decision. */

export const accessListOptions: ListOptions = {
	sortable: [],
	filters: ['status', 'course'],
	defaultSort: { key: 'date', dir: 'asc' }
};

export const accessStatuses = ['pending', 'approved', 'rejected', 'revoked'] as const;
export type AccessStatus = (typeof accessStatuses)[number];
export type AccessFilter = {
	status: AccessStatus | 'all';
	courseId: string | null;
	page: number;
	/** Part of the member name. */
	q?: string;
};

/** Filters of the URL: unknown status — the queue itself, a course id only if it is a uuid. */
export const accessFilter = (state: ListState): AccessFilter => ({
	status:
		state.filters.status === 'all'
			? 'all'
			: (accessStatuses.find((s) => s === state.filters.status) ?? 'pending'),
	courseId: isUuid(state.filters.course ?? '') ? state.filters.course : null,
	page: state.page,
	q: state.q
});

const escapeLike = (s: string) => s.replace(/[\\%_]/g, (c) => `\\${c}`);

function conditions(filter: AccessFilter): SQL | undefined {
	return and(
		filter.status === 'all' ? undefined : eq(courseAccess.status, filter.status),
		filter.courseId ? eq(courseAccess.courseId, filter.courseId) : undefined,
		filter.q ? ilike(users.name, `%${escapeLike(filter.q)}%`) : undefined
	);
}

/* The end of the membership that covers now, the latest of the active ones (memberships/overview). */
const paidUntil = (now: Date) => {
	const at = sql`${now.toISOString()}::timestamptz`;
	return sql`(select max(m.ends_at) from memberships m
		where m.user_id = users.id and m.status = 'active' and m.ends_at > ${at}
			and exists (select 1 from memberships c where c.user_id = users.id and c.status = 'active'
				and c.starts_at <= ${at} and c.ends_at > ${at}))`.mapWith(courseAccess.updatedAt);
};

export async function listAccess(db: LimitDb, filter: AccessFilter, now = new Date()) {
	if (filter.courseId && !isUuid(filter.courseId)) return { rows: [], total: 0 };
	const where = conditions(filter);
	const [rows, [{ total }]] = await Promise.all([
		db
			.select({
				id: courseAccess.id,
				userId: courseAccess.userId,
				name: users.name,
				courseId: courseAccess.courseId,
				courseTitle: courses.title,
				status: courseAccess.status,
				date: courseAccess.updatedAt,
				birthDate: users.birthDate,
				level: users.level,
				paidUntil: paidUntil(now),
				reviewNote: courseAccess.reviewNote
			})
			.from(courseAccess)
			.innerJoin(users, eq(users.id, courseAccess.userId))
			.innerJoin(courses, eq(courses.id, courseAccess.courseId))
			.where(where)
			.orderBy(asc(courseAccess.updatedAt), asc(courseAccess.id))
			.limit(PAGE_SIZE)
			.offset(pageOffset(filter.page)),
		db
			.select({ total: count() })
			.from(courseAccess)
			.innerJoin(users, eq(users.id, courseAccess.userId))
			.where(where)
	]);
	return {
		rows: rows.map(({ birthDate, ...r }) => ({
			...r,
			courseTitle: r.courseTitle as PortalText,
			paidUntil: (r.paidUntil as Date | null) ?? null,
			age: birthDate ? ageOn(birthDate, now) : null
		})),
		total
	};
}
export type AccessListRow = Awaited<ReturnType<typeof listAccess>>['rows'][number];

/** Course choices of the filter. */
export async function accessCourses(db: LimitDb) {
	const rows = await db
		.select({ id: courses.id, title: courses.title })
		.from(courses)
		.orderBy(asc(courses.createdAt));
	return rows.map((r) => ({ id: r.id, title: r.title as PortalText }));
}
