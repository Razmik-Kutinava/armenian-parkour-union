import { and, asc, count, eq, ilike, isNotNull, isNull, not, or, type SQL } from 'drizzle-orm';
import {
	pageOffset,
	PAGE_SIZE,
	type ListOptions,
	type ListState
} from '#lib/components/admin/list-state.ts';
import { ageOn } from '#lib/validation/auth.ts';
import type { LimitDb } from '../../auth/rate-limit';
import { users } from '../../db/schema/users';
import { volunteerCards } from '../../db/schema/volunteer-cards';
import { cardValidity } from './card-rules';
import { minorSql, paidUntilSql, privacySql } from './card-sql';

export { cardDetail, type CardDetail } from './card-detail';

/* docs/05 section 28 "Cards": the queue — pending, oldest first; filters status, flagged, valid;
 * search by name, number and email. Filter values are checked before reaching SQL. */

export const cardListOptions: ListOptions = {
	sortable: [],
	filters: ['status', 'flagged', 'valid'],
	defaultSort: { key: 'appliedAt', dir: 'asc' }
};

export const cardStatuses = ['pending', 'active', 'rejected', 'revoked'] as const;
export type CardFilter = {
	status: (typeof cardStatuses)[number] | 'all';
	flagged: boolean;
	valid: 'yes' | 'no' | null;
	page: number;
	q?: string;
};

export const cardFilter = (state: ListState): CardFilter => ({
	status:
		state.filters.status === 'all'
			? 'all'
			: (cardStatuses.find((s) => s === state.filters.status) ?? 'pending'),
	flagged: state.filters.flagged === '1',
	valid: state.filters.valid === 'yes' || state.filters.valid === 'no' ? state.filters.valid : null,
	page: state.page,
	q: state.q
});

const escapeLike = (s: string) => s.replace(/[\\%_]/g, (c) => `\\${c}`);

/** docs/03 section 19.2 in SQL — the same rule as `cardValidity`. */
const validSql = (now: Date) =>
	and(
		eq(volunteerCards.status, 'active'),
		eq(users.status, 'active'),
		isNotNull(paidUntilSql(now)),
		not(and(minorSql(now), not(privacySql(now)))!)
	)!;

function conditions(filter: CardFilter, now: Date): SQL | undefined {
	const like = filter.q ? `%${escapeLike(filter.q)}%` : null;
	return and(
		isNull(users.deletedAt),
		filter.status === 'all' ? undefined : eq(volunteerCards.status, filter.status),
		filter.flagged ? isNotNull(volunteerCards.flaggedAt) : undefined,
		filter.valid === 'yes' ? validSql(now) : undefined,
		filter.valid === 'no' ? not(validSql(now)) : undefined,
		like
			? or(ilike(users.name, like), ilike(volunteerCards.number, like), ilike(users.email, like))
			: undefined
	);
}

export async function listCards(db: LimitDb, filter: CardFilter, now = new Date()) {
	const where = conditions(filter, now);
	const [rows, [{ total }]] = await Promise.all([
		db
			.select({
				id: volunteerCards.id,
				userId: volunteerCards.userId,
				name: users.name,
				number: volunteerCards.number,
				status: volunteerCards.status,
				appliedAt: volunteerCards.appliedAt,
				declineStreak: volunteerCards.declineStreak,
				flaggedAt: volunteerCards.flaggedAt,
				birthDate: users.birthDate,
				userStatus: users.status,
				paidUntil: paidUntilSql(now),
				privacy: privacySql(now)
			})
			.from(volunteerCards)
			.innerJoin(users, eq(users.id, volunteerCards.userId))
			.where(where)
			.orderBy(asc(volunteerCards.appliedAt), asc(volunteerCards.id))
			.limit(PAGE_SIZE)
			.offset(pageOffset(filter.page)),
		db
			.select({ total: count() })
			.from(volunteerCards)
			.innerJoin(users, eq(users.id, volunteerCards.userId))
			.where(where)
	]);
	return {
		rows: rows.map(({ birthDate, userStatus, privacy, flaggedAt, ...r }) => ({
			...r,
			age: birthDate ? ageOn(birthDate, now) : null,
			flagged: flaggedAt !== null,
			validity: cardValidity(
				r.status,
				{ birthDate, status: userStatus, paidUntil: r.paidUntil, privacy },
				now
			)
		})),
		total
	};
}
export type CardListRow = Awaited<ReturnType<typeof listCards>>['rows'][number];
