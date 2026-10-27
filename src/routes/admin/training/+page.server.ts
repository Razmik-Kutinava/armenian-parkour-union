import { can } from '#lib/server/auth/permissions.ts';
import { requirePermission } from '#lib/server/auth/guard.ts';
import { db } from '#lib/server/db/index.ts';
import { listCourses } from '#lib/server/services/training/course-list.ts';
import type { PageServerLoad } from './$types';

/* docs/05 section 27: courses are an admin's; an editor opens them only to reach the lessons. */
export const load: PageServerLoad = async ({ locals }) => {
	const user = requirePermission(locals.user, 'training.lessons');
	return { rows: await listCourses(db), canManage: can(user, 'training.manage') };
};
