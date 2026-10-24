import { readListState } from '#lib/components/admin/list-state.ts';
import { requirePermission } from '#lib/server/auth/guard.ts';
import { db } from '#lib/server/db/index.ts';
import { listStaffProfiles, staffListOptions } from '#lib/server/services/staff/admin-list.ts';
import type { PageServerLoad } from './$types';

/* docs/05 section 9: moderator and admin read (docs/04 section 3). Filters in the URL. */
export const load: PageServerLoad = async ({ locals, url }) => {
	const viewer = requirePermission(locals.user, 'certificates.read');
	const state = readListState(url.searchParams, staffListOptions);
	const { rows, total } = await listStaffProfiles(db, viewer, state);
	return { state, rows, total };
};
