import { and, count, countDistinct, desc, eq, gt, gte, isNull, sql } from 'drizzle-orm';
import type { LimitDb } from '../../auth/rate-limit';
import type { PaymentKind } from '../payments/effects';
import { memberships, payments } from '../../db/schema/payments';
import { pointsLedger } from '../../db/schema/points';
import { users } from '../../db/schema/users';
import { ZONE } from '../audit-list';
import { readSuspicious, suspiciousCondition } from '../points/suspicious';

/* docs/05 section 3, admin-only blocks: the last sign-ups, suspicious points of the last 7 days,
 * short statistics. The route shows them only to `users.read_full`, `points.adjust`, `payments.read`. */

export type RecentUser = { id: string; name: string; email: string; createdAt: Date };
export type SuspiciousRow = {
	id: string;
	userId: string;
	name: string;
	delta: number;
	reason: (typeof pointsLedger.$inferSelect)['reason'];
	createdAt: Date;
};
export type MonthPayments = {
	kind: PaymentKind;
	currency: string;
	count: number;
	amountMinor: number;
};
export type ShortStats = { users: number; activeMembers: number; payments: MonthPayments[] };

const RECENT = 10;
const SUSPICIOUS_ROWS = 5;
const WEEK_DAYS = 7;

export function recentUsers(db: LimitDb): Promise<RecentUser[]> {
	return db
		.select({ id: users.id, name: users.name, email: users.email, createdAt: users.createdAt })
		.from(users)
		.where(isNull(users.deletedAt))
		.orderBy(desc(users.createdAt), desc(users.id))
		.limit(RECENT);
}

/** Entries flagged by the ledger filter "suspicious", created within the last 7 days. */
export async function suspiciousWeek(
	db: LimitDb
): Promise<{ total: number; rows: SuspiciousRow[]; href: string }> {
	const since = new Date(Date.now() - WEEK_DAYS * 86_400_000);
	const where = and(
		gte(pointsLedger.createdAt, since),
		suspiciousCondition(await readSuspicious(db))
	);
	const [{ total }] = await db.select({ total: count() }).from(pointsLedger).where(where);
	const rows = await db
		.select({
			id: pointsLedger.id,
			userId: pointsLedger.userId,
			name: users.name,
			delta: pointsLedger.delta,
			reason: pointsLedger.reason,
			createdAt: pointsLedger.createdAt
		})
		.from(pointsLedger)
		.innerJoin(users, eq(users.id, pointsLedger.userId))
		.where(where)
		.orderBy(desc(pointsLedger.createdAt), desc(pointsLedger.id))
		.limit(SUSPICIOUS_ROWS);
	const from = since.toLocaleDateString('sv-SE', { timeZone: ZONE });
	return { total, rows, href: `/admin/points?suspicious=1&from=${from}` };
}

/** Paid payments of the current calendar month in Yerevan, by kind and currency. */
export async function shortStats(db: LimitDb): Promise<ShortStats> {
	const [{ n: userCount }] = await db
		.select({ n: count() })
		.from(users)
		.where(isNull(users.deletedAt));
	const [{ n: activeMembers }] = await db
		.select({ n: countDistinct(memberships.userId) })
		.from(memberships)
		.where(and(eq(memberships.status, 'active'), gt(memberships.endsAt, sql`now()`)));
	const monthStart = sql`date_trunc('month', now() at time zone ${ZONE}) at time zone ${ZONE}`;
	const rows = await db
		.select({
			kind: payments.kind,
			currency: payments.currency,
			count: count(),
			amountMinor: sql<string>`sum(${payments.amountMinor})`
		})
		.from(payments)
		.where(and(eq(payments.status, 'paid'), gte(payments.paidAt, monthStart)))
		.groupBy(payments.kind, payments.currency)
		.orderBy(payments.kind, payments.currency);
	return {
		users: userCount,
		activeMembers,
		payments: rows.map((r) => ({ ...r, amountMinor: Number(r.amountMinor) }))
	};
}
