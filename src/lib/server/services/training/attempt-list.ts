import { and, count, desc, eq, ilike, isNull, sql, type SQL } from 'drizzle-orm';
import {
	pageOffset,
	PAGE_SIZE,
	type ListOptions,
	type ListState
} from '#lib/components/admin/list-state.ts';
import type { PortalText } from '#lib/i18n/localized.ts';
import type { LimitDb } from '../../auth/rate-limit';
import { courses } from '../../db/schema/training';
import { quizAttempts } from '../../db/schema/training-progress';
import { users } from '../../db/schema/users';
import { validDay, ZONE } from '../audit-list';
import { isUuid } from '../users/target';

/* docs/05 section 27 "Attempts" (moderator read, admin): the list. Decisions — docs/todo.md 9.11.
 * Reads only: an expired unsettled attempt stays as it is. */

export const attemptListOptions: ListOptions = {
	sortable: [],
	filters: ['course', 'result', 'from', 'to'],
	defaultSort: { key: 'started', dir: 'desc' }
};

export const attemptResults = ['passed', 'failed', 'running'] as const;
export type AttemptFilter = {
	courseId: string | null;
	result: (typeof attemptResults)[number] | 'all';
	from: string | null;
	to: string | null;
	page: number;
	/** Part of the member name. */
	q?: string;
};

export const attemptFilter = (state: ListState): AttemptFilter => ({
	courseId: state.filters.course && isUuid(state.filters.course) ? state.filters.course : null,
	result: attemptResults.find((r) => r === state.filters.result) ?? 'all',
	from: validDay(state.filters.from) ?? null,
	to: validDay(state.filters.to) ?? null,
	page: state.page,
	q: state.q
});

/** `expired` — past its time and not closed yet. */
export type AttemptResult = 'passed' | 'failed' | 'running' | 'expired';
export const resultOf = (
	a: { passed: boolean | null; expiresAt: Date },
	now: Date
): AttemptResult =>
	a.passed === true
		? 'passed'
		: a.passed === false
			? 'failed'
			: a.expiresAt > now
				? 'running'
				: 'expired';

const a = quizAttempts;
const escapeLike = (v: string) => v.replace(/[\\%_]/g, (c) => `\\${c}`);
export const attemptColumns = {
	id: a.id,
	userId: a.userId,
	name: users.name,
	courseId: a.courseId,
	courseTitle: courses.title,
	startedAt: a.startedAt,
	expiresAt: a.expiresAt,
	submittedAt: a.submittedAt,
	correctCount: a.correctCount,
	total: a.total,
	passCount: a.passCount,
	passed: a.passed,
	isExtra: a.isExtra
};
type Joined = { courseTitle: unknown; passed: boolean | null; expiresAt: Date };
export const typed = <T extends Joined>(r: T, now: Date) => ({
	...r,
	courseTitle: r.courseTitle as PortalText,
	result: resultOf(r, now)
});

function conditions(f: AttemptFilter): SQL | undefined {
	return and(
		f.courseId ? eq(a.courseId, f.courseId) : undefined,
		f.result === 'passed' ? eq(a.passed, true) : undefined,
		f.result === 'failed' ? eq(a.passed, false) : undefined,
		f.result === 'running' ? isNull(a.passed) : undefined,
		f.from ? sql`${a.startedAt} >= (${f.from}::date)::timestamp at time zone ${ZONE}` : undefined,
		f.to ? sql`${a.startedAt} < (${f.to}::date + 1)::timestamp at time zone ${ZONE}` : undefined,
		f.q ? ilike(users.name, `%${escapeLike(f.q)}%`) : undefined
	);
}

export async function listAttempts(db: LimitDb, filter: AttemptFilter, now = new Date()) {
	const where = conditions(filter);
	const [rows, [{ total }]] = await Promise.all([
		db
			.select(attemptColumns)
			.from(a)
			.innerJoin(courses, eq(courses.id, a.courseId))
			.innerJoin(users, eq(users.id, a.userId))
			.where(where)
			.orderBy(desc(a.startedAt), desc(a.id))
			.limit(PAGE_SIZE)
			.offset(pageOffset(filter.page)),
		db.select({ total: count() }).from(a).innerJoin(users, eq(users.id, a.userId)).where(where)
	]);
	return { rows: rows.map((r) => typed(r, now)), total };
}
export type AttemptListRow = Awaited<ReturnType<typeof listAttempts>>['rows'][number];
