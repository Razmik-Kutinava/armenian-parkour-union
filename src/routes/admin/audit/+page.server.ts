import { readListState } from '#lib/components/admin/list-state.ts';
import { requirePermission } from '#lib/server/auth/guard.ts';
import { db } from '#lib/server/db/index.ts';
import { auditFilterOptions, auditListOptions, listAudit } from '#lib/server/services/audit.ts';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals, url }) => {
	requirePermission(locals.user, 'audit.read');
	const state = readListState(url.searchParams, auditListOptions);
	const [{ rows, total }, options] = await Promise.all([
		listAudit(db, state),
		auditFilterOptions(db)
	]);
	return { state, rows, total, options, query: url.search };
};
