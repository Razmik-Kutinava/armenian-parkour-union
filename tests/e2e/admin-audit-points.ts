import type postgres from 'postgres';
import type { AdminAction } from './admin-audit-map';

type PointsAction = Extract<AdminAction, `/admin/points${string}`>;
type Post = (path: string, form?: Record<string, string>) => Promise<void>;

/** Points ledger actions for admin-audit.spec.ts: the entry to reverse is written by SQL, not logged. */
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
		}
	};
}
