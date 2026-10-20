import { and, eq, isNull, sql } from 'drizzle-orm';
import type { LimitDb } from '../../auth/rate-limit';
import { pointsLedger } from '../../db/schema/points';
import { users } from '../../db/schema/users';

export type NewEntry = typeof pointsLedger.$inferInsert;
export type LedgerEntry = typeof pointsLedger.$inferSelect;

export type AppendResult =
	| { status: 'ok'; entry: LedgerEntry; balanceBefore: number; balanceAfter: number }
	| { status: 'duplicate' | 'insufficient_balance' | 'no_user' };

/**
 * docs/02 section 5: the only way to write the ledger. The user row is locked, so two operations of
 * one user count the balance one after another; below zero is refused before anything is written.
 * A once-only conflict (same source, second reversal) writes nothing and keeps the caller's
 * transaction usable.
 */
export async function appendEntry(tx: LimitDb, entry: NewEntry): Promise<AppendResult> {
	const [user] = await tx
		.select({ balance: users.pointsBalance })
		.from(users)
		.where(and(eq(users.id, entry.userId), isNull(users.deletedAt)))
		.for('no key update');
	if (!user) return { status: 'no_user' };
	const balanceAfter = user.balance + entry.delta;
	if (balanceAfter < 0) return { status: 'insufficient_balance' };
	const [row] = await tx.insert(pointsLedger).values(entry).onConflictDoNothing().returning();
	if (!row) return { status: 'duplicate' };
	await tx
		.update(users)
		.set({ pointsBalance: sql`${users.pointsBalance} + ${entry.delta}` })
		.where(eq(users.id, entry.userId));
	return { status: 'ok', entry: row, balanceBefore: user.balance, balanceAfter };
}
