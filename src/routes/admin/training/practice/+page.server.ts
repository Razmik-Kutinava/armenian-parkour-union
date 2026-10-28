import { readListState } from '#lib/components/admin/list-state.ts';
import { requirePermission } from '#lib/server/auth/guard.ts';
import { db } from '#lib/server/db/index.ts';
import { accessCourses } from '#lib/server/services/training/access-list.ts';
import {
	listPractice,
	practiceChoices,
	practiceFilter,
	practiceListOptions
} from '#lib/server/services/training/practice-queue.ts';
import type { PageServerLoad } from './$types';

/* docs/05 section 27 "Practice" (moderator, admin): the queue; decisions — on the card. */
export const load: PageServerLoad = async ({ locals, url }) => {
	requirePermission(locals.user, 'training.review');
	const read = readListState(url.searchParams, practiceListOptions);
	const filter = practiceFilter(read);
	const state = { ...read, filters: { ...read.filters, status: filter.status } };
	const [{ rows, total }, courses, tasks] = await Promise.all([
		listPractice(db, filter),
		accessCourses(db),
		practiceChoices(db)
	]);
	return { state, rows, total, courses, tasks };
};
