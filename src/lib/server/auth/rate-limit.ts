import { and, eq, gt, gte, sql } from 'drizzle-orm';
import type { PgDatabase, PgQueryResultHKT } from 'drizzle-orm/pg-core';
import { rateLimit } from '../db/schema/auth';

// eslint-disable-next-line @typescript-eslint/no-explicit-any -- any drizzle pg database or transaction
export type LimitDb = PgDatabase<PgQueryResultHKT, any>;
export type LimitRule = { windowMs: number; max: number };

/** Security settings, not business rules (owner decision 2026-10-07, docs/04 section 6.7). */
export const limits = {
	signInPerIp: { windowMs: 60_000, max: 5 },
	staffSignInFailures: { windowMs: 15 * 60_000, max: 5 },
	signUpPerIp: { windowMs: 60 * 60_000, max: 10 },
	passwordResetPerIp: { windowMs: 15 * 60_000, max: 5 }
} satisfies Record<string, LimitRule>;

/* Fixed window per key; `last_request` holds the start of the current window (ms). */

/** Counts an attempt. Returns false when it is over the limit. */
export async function consume(db: LimitDb, key: string, rule: LimitRule, now = Date.now()) {
	const expired = sql`${rateLimit.lastRequest} <= ${now - rule.windowMs}`;
	const [row] = await db
		.insert(rateLimit)
		.values({ key, count: 1, lastRequest: now })
		.onConflictDoUpdate({
			target: rateLimit.key,
			set: {
				count: sql`case when ${expired} then 1 else ${rateLimit.count} + 1 end`,
				lastRequest: sql`case when ${expired} then ${now} else ${rateLimit.lastRequest} end`
			}
		})
		.returning({ count: rateLimit.count });
	return row.count <= rule.max;
}

/** True when the key has used up its window, without counting this check. */
export async function isLimited(db: LimitDb, key: string, rule: LimitRule, now = Date.now()) {
	const rows = await db
		.select({ key: rateLimit.key })
		.from(rateLimit)
		.where(
			and(
				eq(rateLimit.key, key),
				gt(rateLimit.lastRequest, now - rule.windowMs),
				gte(rateLimit.count, rule.max)
			)
		)
		.limit(1);
	return rows.length > 0;
}
