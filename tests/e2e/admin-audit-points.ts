import type postgres from 'postgres';
import type { AdminAction } from './admin-audit-map';

type PointsAction = Extract<AdminAction, `/admin/point${string}`>;
type Post = (path: string, form?: Record<string, string>) => Promise<void>;

/** Seed thresholds (decisions.md 2026-10-21): the CI database may have no key yet. */
const THRESHOLDS = { manual: true, min_amount: 100, burst_count: 5, burst_hours: 24 };

/**
 * Points actions for admin-audit.spec.ts. The entry to reverse and the rule to edit are written by
 * SQL, not logged; the rule is an inactive e2e code, so no award and no member sees it.
 */
export function pointsActions(
	sql: postgres.Sql,
	post: Post,
	target: string
): Record<PointsAction, () => Promise<void>> {
	return {
		'/admin/points/new?/default': () =>
			post('/admin/points/new', { userId: target, delta: '25', comment: 'Audit check' }),
		'/admin/points?/reverse': async () => {
			const [entry] = await sql`
				insert into points_ledger (user_id, delta, reason, comment)
				values (${target}, 10, 'manual', 'Audit seed') returning id`;
			await sql`update users set points_balance = points_balance + 10 where id = ${target}`;
			await post('/admin/points?/reverse', { entryId: entry.id, comment: 'Audit check' });
		},
		'/admin/point-rules/[id]?/default': async () => {
			const [rule] = await sql`
				insert into points_rules (code, title, points, is_active)
				values (${`e2e-audit-${crypto.randomUUID()}`}, ${sql.json({ en: 'Audit rule' })}, 10, false)
				returning id`;
			await post(`/admin/point-rules/${rule.id}`, {
				'title.en': 'Audit rule edited',
				points: '11'
			});
			await sql`delete from points_rules where id = ${rule.id}`;
		},
		/* A change and back: an unchanged key writes no entry; other specs keep their thresholds. */
		'/admin/point-rules?/thresholds': async () => {
			const [row] = await sql`select value from site_settings where key = 'points_suspicious'`;
			const now = { ...THRESHOLDS, ...(row?.value ?? {}) };
			const form = (hours: number) => ({
				...(now.manual ? { manual: 'on' } : {}),
				minAmount: String(now.min_amount),
				burstCount: String(now.burst_count),
				burstHours: String(hours)
			});
			await post('/admin/point-rules?/thresholds', form(now.burst_hours === 23 ? 24 : 23));
			await post('/admin/point-rules?/thresholds', form(now.burst_hours));
		}
	};
}
