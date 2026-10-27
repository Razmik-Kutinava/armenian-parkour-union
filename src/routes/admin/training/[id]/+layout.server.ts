import { error } from '@sveltejs/kit';
import { can } from '#lib/server/auth/permissions.ts';
import { requirePermission } from '#lib/server/auth/guard.ts';
import { db } from '#lib/server/db/index.ts';
import { getCourse } from '#lib/server/services/training/course-list.ts';
import type { LayoutServerLoad } from './$types';

/* The course header and its tabs; each page and action checks its own permission. */
export const load: LayoutServerLoad = async ({ locals, params }) => {
	const user = requirePermission(locals.user, 'training.lessons');
	const course = await getCourse(db, params.id);
	if (!course) error(404, 'Not found');
	const { id, title, status } = course;
	return { course: { id, title, status }, canManage: can(user, 'training.manage') };
};
