import { redirect } from '@sveltejs/kit';
import { requirePermission } from '#lib/server/auth/guard.ts';
import { db } from '#lib/server/db/index.ts';
import { createLesson } from '#lib/server/services/training/lessons.ts';
import { readLessonForm, refusedLesson, topicChoices } from '../form';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals, params }) => {
	requirePermission(locals.user, 'training.lessons');
	return { topics: await topicChoices(params.id) };
};

export const actions: Actions = {
	default: async (event) => {
		const actor = requirePermission(event.locals.user, 'training.lessons');
		const form = await readLessonForm(event.request);
		if (form.failure) return form.failure;
		const { id } = event.params;
		const result = await createLesson(db, actor, id, form.values, event.getClientAddress());
		if (typeof result === 'string') return refusedLesson(result, form.raw);
		redirect(303, `/admin/training/${id}/lessons/${result.id}`);
	}
};
