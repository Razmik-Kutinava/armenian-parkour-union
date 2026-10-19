import { and, eq, lte, notExists } from 'drizzle-orm';
import type { LimitDb } from '../../auth/rate-limit';
import { memberships, payments } from '../../db/schema/payments';
import { logMembershipStatus } from './log';
import type { MembershipMailDeps } from './mail';
import { sendReminders } from './reminders';

export type DailyDeps = MembershipMailDeps & { now?: Date };
export type DailySummary = { expired: number; closed: number; reminded: number };

const DAY_MS = 86_400_000;

/** docs/03 section 2 p. 4: `active` past its end becomes `expired`. */
async function expireEnded(db: LimitDb, now: Date): Promise<number> {
	return db.transaction(async (tx) => {
		const rows = await tx
			.update(memberships)
			.set({ status: 'expired' })
			.where(and(eq(memberships.status, 'active'), lte(memberships.endsAt, now)))
			.returning({ id: memberships.id });
		for (const { id } of rows) await logMembershipStatus(tx, id, 'active', 'expired');
		return rows.length;
	});
}

/** docs/07 section 5.1 p. 5: a pending membership whose payment is over (failed, provider error). */
async function closeStale(db: LimitDb, now: Date): Promise<number> {
	const waiting = db
		.select({ id: payments.id })
		.from(payments)
		.where(and(eq(payments.membershipId, memberships.id), eq(payments.status, 'pending')));
	return db.transaction(async (tx) => {
		const rows = await tx
			.update(memberships)
			.set({ status: 'cancelled' })
			.where(
				and(
					eq(memberships.status, 'pending'),
					lte(memberships.createdAt, new Date(now.getTime() - DAY_MS)),
					notExists(waiting)
				)
			)
			.returning({ id: memberships.id });
		for (const { id } of rows) await logMembershipStatus(tx, id, 'pending', 'cancelled');
		return rows.length;
	});
}

/** Once a day (`POST /api/cron/memberships`); safe to run again. */
export async function runMembershipDaily(db: LimitDb, deps: DailyDeps): Promise<DailySummary> {
	const now = deps.now ?? new Date();
	const expired = await expireEnded(db, now);
	const closed = await closeStale(db, now);
	const reminded = await sendReminders(db, now, deps);
	return { expired, closed, reminded };
}
