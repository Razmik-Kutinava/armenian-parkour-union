import { error } from '@sveltejs/kit';
import { requirePermission } from '#lib/server/auth/guard.ts';
import { db } from '#lib/server/db/index.ts';
import { getCourse } from '#lib/server/services/training/course-list.ts';
import { updateCourse } from '#lib/server/services/training/courses.ts';
import { courseFormValues, readCourseForm, refusedCourse } from '../form';
import type { Actions, PageServerLoad } from './$types';

/* docs/05 section 27: the course form with quiz and admission settings (admin). */
export const load: PageServerLoad = async ({ locals, params }) => {
	requirePermission(locals.user, 'training.manage');
	const course = await getCourse(db, params.id);
	if (!course) error(404, 'Not found');
	return { values: courseFormValues(course) };
};

export const actions: Actions = {
	update: async (event) => {
		const actor = requirePermission(event.locals.user, 'training.manage');
		const form = await readCourseForm(event.request);
		if (form.failure) return form.failure;
		const ip = event.getClientAddress();
		const result = await updateCourse(db, actor, event.params.id, form.values, ip);
		if (result !== 'ok') return refusedCourse(result, form.raw);
		return { saved: true as const };
	}
};
