import type { ListState } from '#lib/components/admin/list-state.ts';
import type { LimitDb } from '../../auth/rate-limit';
import { toCsv } from '../audit-csv';
import { pointsQuery, type PointsListRow } from './admin-list';

/* docs/05 section 12: CSV of the ledger with the filters of the list. */

/** Same filters and order as the list; capped so a click cannot hang the server. */
export async function pointsForExport(
	db: LimitDb,
	state: ListState,
	max = 10_000
): Promise<PointsListRow[]> {
	return pointsQuery(db, state).limit(max);
}

const HEADER = [
	'created_at',
	'entry_id',
	'user_id',
	'user_name',
	'user_email',
	'delta',
	'reason',
	'source_type',
	'source_id',
	'comment',
	'created_by',
	'reversal_of',
	'reversed_by'
];

export function pointsCsv(rows: PointsListRow[]): string {
	return toCsv(
		HEADER,
		rows.map((r) => [
			r.createdAt,
			r.id,
			r.userId,
			r.userName,
			r.userEmail,
			r.delta,
			r.reason,
			r.sourceType,
			r.sourceId,
			r.comment,
			r.createdByName,
			r.reversalOfId,
			r.reversedById
		])
	);
}
