import { readListState } from '#lib/components/admin/list-state.ts';
import { requirePermission } from '#lib/server/auth/guard.ts';
import { db } from '#lib/server/db/index.ts';
import { pointsCsv, pointsForExport } from '#lib/server/services/points/admin-export.ts';
import { pointsListOptions } from '#lib/server/services/points/admin-list.ts';
import type { RequestHandler } from './$types';

/** docs/05 section 12: CSV with the filters of the list; admin only (decisions.md 2026-10-21). */
export const GET: RequestHandler = async ({ locals, url }) => {
	requirePermission(locals.user, 'points.adjust');
	const rows = await pointsForExport(db, readListState(url.searchParams, pointsListOptions));
	const day = new Date().toISOString().slice(0, 10);
	// BOM: spreadsheets then read Armenian and Russian text as UTF-8
	return new Response('\uFEFF' + pointsCsv(rows), {
		headers: {
			'content-type': 'text/csv; charset=utf-8',
			'content-disposition': `attachment; filename="points-${day}.csv"`,
			'cache-control': 'no-store'
		}
	});
};
