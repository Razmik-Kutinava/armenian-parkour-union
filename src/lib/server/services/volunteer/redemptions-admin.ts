import { and, asc, count, desc, eq, ilike, isNull, or, sql, type SQL } from 'drizzle-orm';
import { alias } from 'drizzle-orm/pg-core';
import {
	PAGE_SIZE,
	pageOffset,
	type ListOptions,
	type ListState
} from '#lib/components/admin/list-state.ts';
import type { LocalizedText } from '#lib/i18n/localized.ts';
import type { LimitDb } from '../../auth/rate-limit';
import { perkRedemptions, volunteerCards } from '../../db/schema/volunteer-cards';
import {
	partnerCashiers,
	volunteerPartners,
	volunteerPerks
} from '../../db/schema/volunteer-partners';
import { users } from '../../db/schema/users';
import { toCsv } from '../audit-csv';
import { validDay, ZONE } from '../audit-list';
import { isUuid } from '../users/target';

/* docs/05 section 28 "Redemptions": journal, summary by partner, CSV. */

export const redemptionsListOptions: ListOptions = {
	sortable: ['createdAt'],
	filters: ['partner', 'perk', 'from', 'to'],
	defaultSort: { key: 'createdAt', dir: 'desc' }
};

const author = alias(users, 'author');
const reversal = alias(perkRedemptions, 'reversal');
const escapeLike = (s: string) => s.replace(/[\\%_]/g, (c) => `\\${c}`);

export type RedemptionRow = {
	id: string;
	createdAt: Date;
	cardId: string;
	cardNumber: string | null;
	memberName: string;
	partnerId: string;
	partnerName: string;
	perkId: string;
	perkTitle: LocalizedText;
	cashierLabel: string | null;
	comment: string | null;
	createdByName: string | null;
	reversalOfId: string | null;
	reversedById: string | null;
};

export type RedemptionSummaryLine = {
	partnerId: string;
	partnerName: string;
	perkId: string;
	perkTitle: LocalizedText;
	marks: number;
	uniqueCards: number;
};

function conditions(state: ListState): SQL | undefined {
	const f = state.filters;
	const where: (SQL | undefined)[] = [];
	if (state.q) {
		const like = `%${escapeLike(state.q)}%`;
		where.push(
			or(
				ilike(users.name, like),
				ilike(volunteerCards.number, like),
				isUuid(state.q) ? eq(volunteerCards.id, state.q) : undefined
			)
		);
	}
	if (f.partner && isUuid(f.partner)) where.push(eq(perkRedemptions.partnerId, f.partner));
	if (f.perk && isUuid(f.perk)) where.push(eq(perkRedemptions.perkId, f.perk));
	const from = validDay(f.from);
	if (from)
		where.push(
			sql`${perkRedemptions.createdAt} >= (${from}::date)::timestamp at time zone ${ZONE}`
		);
	const to = validDay(f.to);
	if (to)
		where.push(
			sql`${perkRedemptions.createdAt} < (${to}::date + 1)::timestamp at time zone ${ZONE}`
		);
	return and(...where);
}

const columns = {
	id: perkRedemptions.id,
	createdAt: perkRedemptions.createdAt,
	cardId: perkRedemptions.cardId,
	cardNumber: volunteerCards.number,
	memberName: users.name,
	partnerId: perkRedemptions.partnerId,
	partnerName: volunteerPartners.name,
	perkId: perkRedemptions.perkId,
	perkTitle: volunteerPerks.title,
	cashierLabel: partnerCashiers.label,
	comment: perkRedemptions.comment,
	createdByName: author.name,
	reversalOfId: perkRedemptions.reversalOfId,
	reversedById: reversal.id
};

function baseQuery(db: LimitDb, state: ListState) {
	return db
		.select(columns)
		.from(perkRedemptions)
		.innerJoin(volunteerCards, eq(volunteerCards.id, perkRedemptions.cardId))
		.innerJoin(users, eq(users.id, volunteerCards.userId))
		.innerJoin(volunteerPartners, eq(volunteerPartners.id, perkRedemptions.partnerId))
		.innerJoin(volunteerPerks, eq(volunteerPerks.id, perkRedemptions.perkId))
		.leftJoin(partnerCashiers, eq(partnerCashiers.id, perkRedemptions.cashierId))
		.leftJoin(author, eq(author.id, perkRedemptions.createdBy))
		.leftJoin(reversal, eq(reversal.reversalOfId, perkRedemptions.id))
		.where(conditions(state))
		.orderBy(desc(perkRedemptions.createdAt), desc(perkRedemptions.id))
		.$dynamic();
}

export async function listRedemptions(
	db: LimitDb,
	state: ListState
): Promise<{ rows: RedemptionRow[]; total: number }> {
	const raw = await baseQuery(db, state).limit(PAGE_SIZE).offset(pageOffset(state.page));
	const [{ total }] = await db
		.select({ total: count() })
		.from(perkRedemptions)
		.innerJoin(volunteerCards, eq(volunteerCards.id, perkRedemptions.cardId))
		.innerJoin(users, eq(users.id, volunteerCards.userId))
		.where(conditions(state));
	return {
		rows: raw.map((r) => ({ ...r, perkTitle: r.perkTitle as LocalizedText })),
		total
	};
}

/** Non-reversed cashier marks in the period/filters — marks and unique cards per perk. */
export async function redemptionsSummary(
	db: LimitDb,
	state: ListState
): Promise<RedemptionSummaryLine[]> {
	const where = and(
		conditions(state),
		isNull(perkRedemptions.reversalOfId),
		sql`not exists (select 1 from perk_redemptions x where x.reversal_of_id = ${perkRedemptions.id})`
	);
	const rows = await db
		.select({
			partnerId: volunteerPartners.id,
			partnerName: volunteerPartners.name,
			perkId: volunteerPerks.id,
			perkTitle: volunteerPerks.title,
			marks: sql<number>`count(*)::int`.mapWith(Number),
			uniqueCards: sql<number>`count(distinct ${perkRedemptions.cardId})::int`.mapWith(Number)
		})
		.from(perkRedemptions)
		.innerJoin(volunteerCards, eq(volunteerCards.id, perkRedemptions.cardId))
		.innerJoin(users, eq(users.id, volunteerCards.userId))
		.innerJoin(volunteerPartners, eq(volunteerPartners.id, perkRedemptions.partnerId))
		.innerJoin(volunteerPerks, eq(volunteerPerks.id, perkRedemptions.perkId))
		.where(where)
		.groupBy(volunteerPartners.id, volunteerPartners.name, volunteerPerks.id, volunteerPerks.title)
		.orderBy(asc(volunteerPartners.name), asc(volunteerPerks.sortOrder), asc(volunteerPerks.id));
	return rows.map((r) => ({ ...r, perkTitle: r.perkTitle as LocalizedText }));
}

export async function redemptionsForExport(db: LimitDb, state: ListState, max = 10_000) {
	const raw = await baseQuery(db, state).limit(max);
	return raw.map((r) => ({ ...r, perkTitle: r.perkTitle as LocalizedText }));
}

/** Marks on one card for the admin card page (docs/05 section 28). */
export async function listCardRedemptions(db: LimitDb, cardId: string): Promise<RedemptionRow[]> {
	if (!isUuid(cardId)) return [];
	const { rows } = await listRedemptions(db, {
		page: 1,
		sort: 'createdAt',
		dir: 'desc',
		q: cardId,
		filters: {}
	});
	return rows;
}

const HEADER = [
	'created_at',
	'id',
	'card_number',
	'member',
	'partner',
	'perk',
	'cashier',
	'comment',
	'reversal_of',
	'reversed_by',
	'created_by'
];

export function redemptionsCsv(rows: RedemptionRow[]): string {
	return toCsv(
		HEADER,
		rows.map((r) => [
			r.createdAt,
			r.id,
			r.cardNumber,
			r.memberName,
			r.partnerName,
			typeof r.perkTitle === 'object' ? (r.perkTitle.en ?? r.perkTitle.ru ?? '') : r.perkTitle,
			r.cashierLabel,
			r.comment,
			r.reversalOfId,
			r.reversedById,
			r.createdByName
		])
	);
}
