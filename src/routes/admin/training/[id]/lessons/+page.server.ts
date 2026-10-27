import { requirePermission } from '#lib/server/auth/guard.ts';
import { db } from '#lib/server/db/index.ts';
import { listLessons } from '#lib/server/services/training/lesson-list.ts';
import type { PageServerLoad } from './$types';

/* docs/05 section 27 "Lessons" (training.lessons): the list by topics. */
export const load: PageServerLoad = async ({ locals, params }) => {
	requirePermission(locals.user, 'training.lessons');
	return { lessons: await listLessons(db, params.id) };
};
