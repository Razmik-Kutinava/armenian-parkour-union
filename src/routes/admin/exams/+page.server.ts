import { readListState } from '#lib/components/admin/list-state.ts';
import { requirePermission } from '#lib/server/auth/guard.ts';
import { db } from '#lib/server/db/index.ts';
import { examListOptions, listExams } from '#lib/server/services/exams/index.ts';
import type { PageServerLoad } from './$types';

/* docs/05 section 7: moderator and admin; filters in the URL. */
export const load: PageServerLoad = async ({ locals, url }) => {
	const viewer = requirePermission(locals.user, 'exams.manage');
	const state = readListState(url.searchParams, examListOptions);
	const { rows, total } = await listExams(db, viewer, state);
	return { state, rows, total };
};
