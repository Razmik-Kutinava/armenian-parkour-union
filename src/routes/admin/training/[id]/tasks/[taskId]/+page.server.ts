import { error } from '@sveltejs/kit';
import { requirePermission } from '#lib/server/auth/guard.ts';
import { db } from '#lib/server/db/index.ts';
import { getTask } from '#lib/server/services/training/practice-task-list.ts';
import { updateTask } from '#lib/server/services/training/practice-tasks.ts';
import { readTaskForm, refusedTask, taskFormValues } from '../form';
import type { Actions, PageServerLoad } from './$types';

/* docs/05 section 27 "Practice tasks" (admin): the form; hide / restore — in the list. */
export const load: PageServerLoad = async ({ locals, params }) => {
	requirePermission(locals.user, 'training.manage');
	const task = await getTask(db, params.id, params.taskId);
	if (!task) error(404, 'Not found');
	return {
		task: { id: task.id, title: task.title, hidden: task.hiddenAt !== null },
		values: taskFormValues(task)
	};
};

export const actions: Actions = {
	update: async (event) => {
		const actor = requirePermission(event.locals.user, 'training.manage');
		const form = await readTaskForm(event.request);
		if (form.failure) return form.failure;
		const { id, taskId } = event.params;
		const ip = event.getClientAddress();
		const result = await updateTask(db, actor, id, taskId, form.values, ip);
		if (result !== 'ok') refusedTask(result);
		return { saved: true as const };
	}
};
