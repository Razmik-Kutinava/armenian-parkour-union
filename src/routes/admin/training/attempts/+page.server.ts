import { readListState } from '#lib/components/admin/list-state.ts';
import { requirePermission } from '#lib/server/auth/guard.ts';
import { db } from '#lib/server/db/index.ts';
import { accessCourses } from '#lib/server/services/training/access-list.ts';
import {
	attemptFilter,
	attemptListOptions,
	listAttempts
} from '#lib/server/services/training/attempt-list.ts';
import type { PageServerLoad } from './$types';

/* docs/05 section 27 "Attempts" (moderator read, admin): newest first; the card shows the answers. */
export const load: PageServerLoad = async ({ locals, url }) => {
	requirePermission(locals.user, 'training.review');
	const state = readListState(url.searchParams, attemptListOptions);
	const [{ rows, total }, courses] = await Promise.all([
		listAttempts(db, attemptFilter(state)),
		accessCourses(db)
	]);
	return { state, rows, total, courses };
};
