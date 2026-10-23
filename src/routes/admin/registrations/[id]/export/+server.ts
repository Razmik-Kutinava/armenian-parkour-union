import { readListState } from '#lib/components/admin/list-state.ts';
import { requirePermission } from '#lib/server/auth/guard.ts';
import { can } from '#lib/server/auth/permissions.ts';
import { db } from '#lib/server/db/index.ts';
import {
	registrationListOptions,
	registrationsCsv,
	registrationsForExport
} from '#lib/server/services/registrations/staff/index.ts';
import type { RequestHandler } from './$types';

/** docs/05 section 5: CSV with the filters of the list; the email column only for an admin. */
export const GET: RequestHandler = async ({ locals, params, url }) => {
	const viewer = requirePermission(locals.user, 'registrations.read');
	const state = readListState(url.searchParams, registrationListOptions);
	const rows = await registrationsForExport(db, viewer, params.id, state);
	const csv = registrationsCsv(rows, viewer.locale, can(viewer, 'users.read_full'));
	const day = new Date().toISOString().slice(0, 10);
	// BOM: spreadsheets then read Armenian and Russian text as UTF-8
	return new Response('\uFEFF' + csv, {
		headers: {
			'content-type': 'text/csv; charset=utf-8',
			'content-disposition': `attachment; filename="registrations-${day}.csv"`,
			'cache-control': 'no-store'
		}
	});
};
