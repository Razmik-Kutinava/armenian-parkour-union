import { asc, eq, sql } from 'drizzle-orm';
import type { LimitDb } from '../../auth/rate-limit';
import type { UserRole } from '../../auth/session';
import { pointsLedger, pointsRules } from '../../db/schema/points';
import { users } from '../../db/schema/users';
import { insertUser } from '../../db/test-db';
import type { Actor } from '../users/target';

/* Test support only: points tests run inside a rolled-back transaction. */

type RuleValues = { points?: number; isActive?: boolean };

/**
 * Sets rules for this transaction only. The table lock comes first: the seed test deletes all rules
 * at once, and two tests taking rule rows one by one in different order would deadlock.
 */
export async function setRules(tx: LimitDb, rules: Record<string, RuleValues>) {
	await tx.execute(sql`lock table points_rules in share row exclusive mode`);
	return tx
		.insert(pointsRules)
		.values(
			Object.entries(rules).map(([code, v]) => ({
				code,
				title: { en: code },
				points: v.points ?? 10,
				isActive: v.isActive ?? true
			}))
		)
		.onConflictDoUpdate({
			target: pointsRules.code,
			set: { points: sql`excluded.points`, isActive: sql`excluded.is_active` }
		})
		.returning();
}

export async function staffActor(tx: LimitDb, role: UserRole = 'admin'): Promise<Actor> {
	const { id } = await insertUser(tx, { role });
	return { id, role };
}

export async function balanceOf(tx: LimitDb, userId: string) {
	const [row] = await tx
		.select({ balance: users.pointsBalance })
		.from(users)
		.where(eq(users.id, userId));
	return row.balance;
}

export async function ledgerOf(tx: LimitDb, userId: string) {
	return tx
		.select()
		.from(pointsLedger)
		.where(eq(pointsLedger.userId, userId))
		.orderBy(asc(pointsLedger.createdAt));
}

/** The cached balance must always equal the sum of the user's ledger (docs/02 section 5). */
export async function ledgerSum(tx: LimitDb, userId: string) {
	return (await ledgerOf(tx, userId)).reduce((sum, e) => sum + e.delta, 0);
}
