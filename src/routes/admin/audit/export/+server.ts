import { readListState } from '#lib/components/admin/list-state.ts';
import { requirePermission } from '#lib/server/auth/guard.ts';
import { db } from '#lib/server/db/index.ts';
import { toCsv } from '#lib/server/services/audit-csv.ts';
import { auditForExport, auditListOptions } from '#lib/server/services/audit.ts';
import type { RequestHandler } from './$types';

/** docs/05 section 22: CSV with the filters of the list. */
export const GET: RequestHandler = async ({ locals, url }) => {
	requirePermission(locals.user, 'audit.read');
	const rows = await auditForExport(db, readListState(url.searchParams, auditListOptions));
	const csv = toCsv(
		['created_at', 'actor', 'action', 'entity_type', 'entity_id', 'ip', 'before', 'after'],
		rows.map((r) => [
			r.createdAt,
			r.actorName,
			r.action,
			r.entityType,
			r.entityId,
			r.ip,
			r.before,
			r.after
		])
	);
	const day = new Date().toISOString().slice(0, 10);
	// BOM: spreadsheets then read Armenian and Russian text as UTF-8
	return new Response('\uFEFF' + csv, {
		headers: {
			'content-type': 'text/csv; charset=utf-8',
			'content-disposition': `attachment; filename="audit-${day}.csv"`,
			'cache-control': 'no-store'
		}
	});
};
