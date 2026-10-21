import { eq, isNotNull, or, sql, type SQL } from 'drizzle-orm';
import {
	SUSPICIOUS_DEFAULTS,
	type SuspiciousThresholds
} from '#lib/validation/admin-point-rules.ts';
import { roleCan } from '../../auth/permissions';
import type { LimitDb } from '../../auth/rate-limit';
import { pointsLedger } from '../../db/schema/points';
import { siteSettings } from '../../db/schema/service';
import { writeSettings } from '../site-settings';
import type { Actor } from '../users/target';

export { SUSPICIOUS_DEFAULTS } from '#lib/validation/admin-point-rules.ts';

/* docs/03 section 6.4, decisions.md 2026-10-21: `site_settings.points_suspicious`. */
const KEY = 'points_suspicious';

const isWhole = (v: unknown, min: number, max: number): v is number =>
	typeof v === 'number' && Number.isInteger(v) && v >= min && v <= max;

function readStored(value: unknown): SuspiciousThresholds | null {
	if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
	const v = value as Record<string, unknown>;
	const ok =
		typeof v.manual === 'boolean' &&
		isWhole(v.min_amount, 1, 1_000_000_000) &&
		isWhole(v.burst_count, 2, 1000) &&
		isWhole(v.burst_hours, 1, 720);
	if (!ok) return null;
	return {
		manual: v.manual as boolean,
		minAmount: v.min_amount as number,
		burstCount: v.burst_count as number,
		burstHours: v.burst_hours as number
	};
}

const toStored = (t: SuspiciousThresholds) => ({
	manual: t.manual,
	min_amount: t.minAmount,
	burst_count: t.burstCount,
	burst_hours: t.burstHours
});

/** The stored snake_case value; missing or broken — the defaults, so the filter always works. */
export function parseSuspicious(value: unknown): SuspiciousThresholds {
	return readStored(value) ?? SUSPICIOUS_DEFAULTS;
}

export async function readSuspicious(db: LimitDb): Promise<SuspiciousThresholds> {
	const [row] = await db.select().from(siteSettings).where(eq(siteSettings.key, KEY));
	return parseSuspicious(row?.value);
}

/** Admin only (docs/04: `points.rules`); `writeSettings` logs `settings.update` with before / after. */
export async function saveSuspicious(
	db: LimitDb,
	actor: Actor,
	values: SuspiciousThresholds,
	ip: string | null
): Promise<'ok' | 'not_allowed' | 'invalid'> {
	if (!roleCan(actor.role, 'points.rules')) return 'not_allowed';
	const stored = toStored(values);
	if (!readStored(stored)) return 'invalid';
	await writeSettings(db, actor, { [KEY]: stored }, ip);
	return 'ok';
}

/**
 * Any of: a manual operation (an author is set), |amount| from the threshold, or an entry inside
 * some window of `burstHours` where the member has `burstCount` entries or more — every entry of
 * such a burst, not only the ones from the N-th on.
 */
export function suspiciousCondition(t: SuspiciousThresholds): SQL {
	const hours = sql`make_interval(hours => ${t.burstHours}::int)`;
	const burst = sql`${pointsLedger.id} in (
		select e.id from points_ledger e
		join (
			select w.user_id, w.created_at from (
				select user_id, created_at, count(*) over (
					partition by user_id order by created_at
					range between ${hours} preceding and current row
				) as n
				from points_ledger
			) w
			where w.n >= ${t.burstCount}::int
		) q on q.user_id = e.user_id
			and q.created_at >= e.created_at
			and q.created_at <= e.created_at + ${hours}
	)`;
	return or(
		t.manual ? isNotNull(pointsLedger.createdBy) : undefined,
		sql`abs(${pointsLedger.delta}) >= ${t.minAmount}::int`,
		burst
	)!;
}
