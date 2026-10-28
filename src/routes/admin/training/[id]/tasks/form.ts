import { error, fail } from '@sveltejs/kit';
import type { TaskDetail } from '#lib/server/services/training/practice-task-list.ts';
import { flattenValues, formToObject, settingsErrors } from '#lib/validation/site-settings-form.ts';
import { taskFormSchema } from '#lib/validation/training-practice.ts';

/** The task form, cleaned on the server: the description is stored as richTextSchema returns it. */
export async function readTaskForm(request: Request) {
	const raw = formToObject(await request.formData());
	const parsed = taskFormSchema.safeParse(raw);
	if (parsed.success) return { values: parsed.data };
	return {
		failure: fail(400, { values: flattenValues(raw), errors: settingsErrors(parsed.error) })
	};
}

export function refusedTask(result: 'not_allowed' | 'not_found'): never {
	if (result === 'not_allowed') error(403, 'Forbidden');
	error(404, 'Not found');
}

export function taskFormValues(task: TaskDetail): Record<string, string> {
	return {
		...flattenValues({ title: task.title, description: task.description }),
		sortOrder: String(task.sortOrder)
	};
}
