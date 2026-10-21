import { and, asc, count, desc, eq, gt, inArray, isNull } from 'drizzle-orm';
import { alias } from 'drizzle-orm/pg-core';
import {
	PAGE_SIZE,
	pageOffset,
	type ListOptions,
	type ListState
} from '#lib/components/admin/list-state.ts';
import type { Locale } from '#lib/i18n/locales.ts';
import { pickLocalized, type LocalizedText } from '#lib/i18n/localized.ts';
import type { LimitDb } from '../../auth/rate-limit';
import { pointsReason } from '../../db/schema/enums';
import { pointsLedger, pointsRules } from '../../db/schema/points';
import { users } from '../../db/schema/users';
import { pointsConditions } from '../points/admin-list';
import { RULE_SOURCES } from '../points/award';
import { isUuid } from '../users/target';

/* docs/06 section 5.6: the member's own points; the user id comes from the session (docs/04 5.3). */

/** Only reason and period: search, "manual", "over" and "suspicious" are staff filters. */
export const ownPointsOptions: ListOptions = {
	sortable: ['createdAt'],
	filters: ['reason', 'from', 'to'],
	defaultSort: { key: 'createdAt', dir: 'desc' }
};

export type OwnPointsEntry = {
	id: string;
	createdAt: Date;
	delta: number;
	reason: (typeof pointsReason.enumValues)[number];
	sourceType: string | null;
	comment: string | null;
	/** This entry was reversed later (docs/03 section 6.3 p. 2). */
	reversed: boolean;
	/** For a reversal: the date of the reversed entry. */
	reversalOf: Date | null;
};

export type OwnPoints = { balance: number; rows: OwnPointsEntry[]; total: number };

const reversal = alias(pointsLedger, 'reversal');
const original = alias(pointsLedger, 'original');

/** `null`: a deleted, unknown or malformed user. */
export async function getOwnPoints(
	db: LimitDb,
	userId: string,
	state: ListState
): Promise<OwnPoints | null> {
	if (!isUuid(userId)) return null;
	const [user] = await db
		.select({ balance: users.pointsBalance })
		.from(users)
		.where(and(eq(users.id, userId), isNull(users.deletedAt)));
	if (!user) return null;
	const where = and(
		eq(pointsLedger.userId, userId),
		pointsConditions({ ...state, q: '' }, null, false)
	);
	const rows = await db
		.select({
			id: pointsLedger.id,
			createdAt: pointsLedger.createdAt,
			delta: pointsLedger.delta,
			reason: pointsLedger.reason,
			sourceType: pointsLedger.sourceType,
			comment: pointsLedger.comment,
			reversalId: reversal.id,
			reversalOf: original.createdAt
		})
		.from(pointsLedger)
		.leftJoin(reversal, eq(reversal.reversalOfId, pointsLedger.id))
		.leftJoin(original, eq(original.id, pointsLedger.reversalOfId))
		.where(where)
		.orderBy(desc(pointsLedger.createdAt), desc(pointsLedger.id))
		.limit(PAGE_SIZE)
		.offset(pageOffset(state.page));
	const [{ total }] = await db.select({ total: count() }).from(pointsLedger).where(where);
	return {
		balance: user.balance,
		rows: rows.map(({ reversalId, ...row }) => ({ ...row, reversed: reversalId !== null })),
		total
	};
}

export type EarnRule = { code: string; title: string; points: number };

/** Active rules that award points now; codes no service awards by are left out. */
export async function howToEarn(db: LimitDb, locale: Locale): Promise<EarnRule[]> {
	const rows = await db
		.select({ code: pointsRules.code, title: pointsRules.title, points: pointsRules.points })
		.from(pointsRules)
		.where(
			and(
				eq(pointsRules.isActive, true),
				gt(pointsRules.points, 0),
				inArray(pointsRules.code, Object.keys(RULE_SOURCES))
			)
		)
		.orderBy(desc(pointsRules.points), asc(pointsRules.code));
	return rows.map((r) => ({ ...r, title: pickLocalized(r.title as LocalizedText, locale) }));
}
