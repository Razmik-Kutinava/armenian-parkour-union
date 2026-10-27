import { redirect } from '@sveltejs/kit';
import { requirePermission } from '#lib/server/auth/guard.ts';
import { db } from '#lib/server/db/index.ts';
import { createCourse } from '#lib/server/services/training/courses.ts';
import { readCourseForm, refusedCourse } from '../form';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals }) => {
	requirePermission(locals.user, 'training.manage');
};

export const actions: Actions = {
	default: async (event) => {
		const actor = requirePermission(event.locals.user, 'training.manage');
		const form = await readCourseForm(event.request);
		if (form.failure) return form.failure;
		const result = await createCourse(db, actor, form.values, event.getClientAddress());
		if (typeof result === 'string') return refusedCourse(result, form.raw);
		redirect(303, `/admin/training/${result.id}`);
	}
};
