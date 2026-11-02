import { readListState } from '#lib/components/admin/list-state.ts';
import { requirePermission } from '#lib/server/auth/guard.ts';
import { db } from '#lib/server/db/index.ts';
import {
	listRequests,
	requestFilter,
	requestListOptions
} from '#lib/server/services/volunteer/requests-list.ts';
import type { PageServerLoad } from './$types';

/* docs/05 section 28 "Requests". */
export const load: PageServerLoad = async ({ locals, url }) => {
	requirePermission(locals.user, 'volunteer.manage');
	const read = readListState(url.searchParams, requestListOptions);
	const filter = requestFilter(read);
	const state = { ...read, filters: { ...read.filters, status: filter.status } };
	const { rows, total } = await listRequests(db, filter);
	return { state, rows, total };
};
