import { redirect } from '@sveltejs/kit';
import { requirePermission } from '#lib/server/auth/guard.ts';
import { db } from '#lib/server/db/index.ts';
import { createTask } from '#lib/server/services/training/practice-tasks.ts';
import { readTaskForm, refusedTask } from '../form';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals }) => {
	requirePermission(locals.user, 'training.manage');
};

export const actions: Actions = {
	default: async (event) => {
		const actor = requirePermission(event.locals.user, 'training.manage');
		const form = await readTaskForm(event.request);
		if (form.failure) return form.failure;
		const { id } = event.params;
		const result = await createTask(db, actor, id, form.values, event.getClientAddress());
		if (typeof result === 'string') refusedTask(result);
		redirect(303, `/admin/training/${id}/tasks/${result.id}`);
	}
};
