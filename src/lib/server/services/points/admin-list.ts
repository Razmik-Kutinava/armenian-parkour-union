import { and, asc, count, desc, eq, ilike, isNotNull, or, sql, type SQL } from 'drizzle-orm';
import { alias } from 'drizzle-orm/pg-core';
import {
	PAGE_SIZE,
	pageOffset,
	type ListOptions,
	type ListState
} from '#lib/components/admin/list-state.ts';
import type { SuspiciousThresholds } from '#lib/validation/admin-point-rules.ts';
import type { LimitDb } from '../../auth/rate-limit';
import { pointsReason } from '../../db/schema/enums';
import { pointsLedger } from '../../db/schema/points';
import { users } from '../../db/schema/users';
import { validDay, ZONE } from '../audit-list';
import { isUuid } from '../users/target';
import { readSuspicious, suspiciousCondition } from './suspicious';

/* docs/05 section 12: the points ledger for staff; filter values are checked before reaching SQL. */

export const pointsListOptions: ListOptions = {
	sortable: ['createdAt', 'delta'],
	filters: ['reason', 'from', 'to', 'manual', 'over', 'suspicious'],
	defaultSort: { key: 'createdAt', dir: 'desc' }
};

const author = alias(users, 'author');
const reversal = alias(pointsLedger, 'reversal');
/** "Amount over N": a whole number that fits the column. */
const OVER = /^\d{1,9}$/;
const escapeLike = (s: string) => s.replace(/[\\%_]/g, (c) => `\\${c}`);

export const pointsColumns = {
	id: pointsLedger.id,
	createdAt: pointsLedger.createdAt,
	userId: pointsLedger.userId,
	userName: users.name,
	userEmail: users.email,
	delta: pointsLedger.delta,
	reason: pointsLedger.reason,
	sourceType: pointsLedger.sourceType,
	sourceId: pointsLedger.sourceId,
	comment: pointsLedger.comment,
	createdBy: pointsLedger.createdBy,
	createdByName: author.name,
	reversalOfId: pointsLedger.reversalOfId,
	reversedById: reversal.id
};

export type PointsListRow = {
	id: string;
	createdAt: Date;
	userId: string;
	userName: string | null;
	userEmail: string;
	delta: number;
	reason: (typeof pointsReason.enumValues)[number];
	sourceType: string | null;
	sourceId: string | null;
	comment: string | null;
	createdBy: string | null;
	createdByName: string | null;
	reversalOfId: string | null;
	reversedById: string | null;
};

/** Thresholds are read only when the "suspicious" filter is on (docs/03 section 6.4). */
export async function suspiciousFor(
	db: LimitDb,
	state: ListState
): Promise<SuspiciousThresholds | null> {
	return state.filters.suspicious === '1' ? readSuspicious(db) : null;
}

export function pointsConditions(
	state: ListState,
	suspicious: SuspiciousThresholds | null
): SQL | undefined {
	const f = state.filters;
	const where: (SQL | undefined)[] = [];
	if (state.q) {
		const like = `%${escapeLike(state.q)}%`;
		where.push(
			or(
				ilike(users.name, like),
				ilike(users.email, like),
				isUuid(state.q) ? eq(pointsLedger.userId, state.q) : undefined
			)
		);
	}
	const reason = pointsReason.enumValues.find((r) => r === f.reason);
	if (reason) where.push(eq(pointsLedger.reason, reason));
	const from = validDay(f.from);
	if (from)
		where.push(sql`${pointsLedger.createdAt} >= (${from}::date)::timestamp at time zone ${ZONE}`);
	const to = validDay(f.to);
	if (to)
		where.push(sql`${pointsLedger.createdAt} < (${to}::date + 1)::timestamp at time zone ${ZONE}`);
	if (f.manual === '1') where.push(isNotNull(pointsLedger.createdBy));
	if (f.over && OVER.test(f.over)) where.push(sql`abs(${pointsLedger.delta}) > ${Number(f.over)}`);
	if (suspicious) where.push(suspiciousCondition(suspicious));
	return and(...where);
}

/** The ledger with the member, the author and the reversal of each entry, if any. */
export function pointsQuery(
	db: LimitDb,
	state: ListState,
	suspicious: SuspiciousThresholds | null
) {
	const column = state.sort === 'delta' ? pointsLedger.delta : pointsLedger.createdAt;
	return db
		.select(pointsColumns)
		.from(pointsLedger)
		.innerJoin(users, eq(users.id, pointsLedger.userId))
		.leftJoin(author, eq(author.id, pointsLedger.createdBy))
		.leftJoin(reversal, eq(reversal.reversalOfId, pointsLedger.id))
		.where(pointsConditions(state, suspicious))
		.orderBy(state.dir === 'asc' ? asc(column) : desc(column), desc(pointsLedger.id))
		.$dynamic();
}

export async function listPoints(
	db: LimitDb,
	state: ListState
): Promise<{ rows: PointsListRow[]; total: number }> {
	const suspicious = await suspiciousFor(db, state);
	const rows = await pointsQuery(db, state, suspicious)
		.limit(PAGE_SIZE)
		.offset(pageOffset(state.page));
	const [{ total }] = await db
		.select({ total: count() })
		.from(pointsLedger)
		.innerJoin(users, eq(users.id, pointsLedger.userId))
		.where(pointsConditions(state, suspicious));
	return { rows, total };
}
