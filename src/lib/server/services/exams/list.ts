import { and, count, eq, ilike, isNull, or, sql, type SQL } from 'drizzle-orm';
import { alias } from 'drizzle-orm/pg-core';
import {
	PAGE_SIZE,
	pageOffset,
	type ListOptions,
	type ListState
} from '#lib/components/admin/list-state.ts';
import { roleCan } from '../../auth/permissions';
import type { LimitDb } from '../../auth/rate-limit';
import { exams } from '../../db/schema/certification';
import { examKind, examResult } from '../../db/schema/enums';
import { users } from '../../db/schema/users';
import { validDay, ZONE } from '../audit-list';
import type { Actor } from '../users/target';

/* docs/05 section 7: the exam list; filter values are checked before reaching SQL. */

export const examListOptions: ListOptions = {
	sortable: ['scheduledAt'],
	filters: ['kind', 'result', 'from', 'to'],
	defaultSort: { key: 'scheduledAt', dir: 'desc' }
};

export type ExamListRow = {
	id: string;
	userId: string;
	memberName: string;
	kind: (typeof examKind.enumValues)[number];
	scheduledAt: Date | null;
	examinerName: string | null;
	result: (typeof examResult.enumValues)[number];
	score: string | null;
};

const examiner = alias(users, 'examiner');
const escapeLike = (s: string) => s.replace(/[\\%_]/g, (c) => `\\${c}`);

/** `contacts`: the member email is searched (docs/04 section 4: only with `users.read_full`). */
function conditions(state: ListState, contacts: boolean): SQL | undefined {
	const f = state.filters;
	const where: (SQL | undefined)[] = [isNull(users.deletedAt)];
	if (state.q) {
		const like = `%${escapeLike(state.q)}%`;
		where.push(or(ilike(users.name, like), contacts ? ilike(users.email, like) : undefined));
	}
	const kind = examKind.enumValues.find((k) => k === f.kind);
	if (kind) where.push(eq(exams.kind, kind));
	const result = examResult.enumValues.find((r) => r === f.result);
	if (result) where.push(eq(exams.result, result));
	const from = validDay(f.from);
	if (from)
		where.push(sql`${exams.scheduledAt} >= (${from}::date)::timestamp at time zone ${ZONE}`);
	const to = validDay(f.to);
	if (to) where.push(sql`${exams.scheduledAt} < (${to}::date + 1)::timestamp at time zone ${ZONE}`);
	return and(...where);
}

export async function listExams(
	db: LimitDb,
	viewer: Actor,
	state: ListState
): Promise<{ rows: ExamListRow[]; total: number }> {
	if (!roleCan(viewer.role, 'exams.manage')) return { rows: [], total: 0 };
	const where = conditions(state, roleCan(viewer.role, 'users.read_full'));
	const order =
		state.dir === 'asc'
			? sql`${exams.scheduledAt} asc nulls last`
			: sql`${exams.scheduledAt} desc nulls last`;
	const rows = await db
		.select({
			id: exams.id,
			userId: exams.userId,
			memberName: users.name,
			kind: exams.kind,
			scheduledAt: exams.scheduledAt,
			examinerName: examiner.name,
			result: exams.result,
			score: exams.score
		})
		.from(exams)
		.innerJoin(users, eq(users.id, exams.userId))
		.leftJoin(examiner, eq(examiner.id, exams.examinerId))
		.where(where)
		.orderBy(order, sql`${exams.createdAt} desc`, exams.id)
		.limit(PAGE_SIZE)
		.offset(pageOffset(state.page));
	const [{ total }] = await db
		.select({ total: count() })
		.from(exams)
		.innerJoin(users, eq(users.id, exams.userId))
		.where(where);
	return { rows, total };
}
