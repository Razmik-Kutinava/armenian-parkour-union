import { readListState } from '#lib/components/admin/list-state.ts';
import { requirePermission } from '#lib/server/auth/guard.ts';
import { db } from '#lib/server/db/index.ts';
import {
	redemptionsCsv,
	redemptionsForExport,
	redemptionsListOptions
} from '#lib/server/services/volunteer/redemptions-admin.ts';
import type { RequestHandler } from './$types';

/** docs/05 section 28: CSV with the filters of the journal. */
export const GET: RequestHandler = async ({ locals, url }) => {
	requirePermission(locals.user, 'volunteer.manage');
	const rows = await redemptionsForExport(
		db,
		readListState(url.searchParams, redemptionsListOptions)
	);
	const day = new Date().toISOString().slice(0, 10);
	return new Response('\uFEFF' + redemptionsCsv(rows), {
		headers: {
			'content-type': 'text/csv; charset=utf-8',
			'content-disposition': `attachment; filename="perk-redemptions-${day}.csv"`,
			'cache-control': 'no-store'
		}
	});
};
