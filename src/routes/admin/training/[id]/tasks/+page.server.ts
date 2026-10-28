import { error, fail, type RequestEvent } from '@sveltejs/kit';
import { PUBLIC_SITE_URL } from '$app/env/private';
import { requirePermission } from '#lib/server/auth/guard.ts';
import { db } from '#lib/server/db/index.ts';
import { sendMail } from '#lib/server/mail/index.ts';
import { listTasks } from '#lib/server/services/training/practice-task-list.ts';
import { setTaskHidden } from '#lib/server/services/training/practice-tasks.ts';
import { taskIdSchema } from '#lib/validation/training-practice.ts';
import type { Actions, PageServerLoad } from './$types';

/* docs/05 section 27 "Practice tasks" (admin): the list, hide / restore; hiding may finish the
 * course of members who had every other task accepted (docs/03 section 18.5). */
export const load: PageServerLoad = async ({ locals, params }) => {
	requirePermission(locals.user, 'training.manage');
	return { tasks: await listTasks(db, params.id) };
};

async function hidden(event: RequestEvent<{ id: string }>, hide: boolean) {
	const actor = requirePermission(event.locals.user, 'training.manage');
	const parsed = taskIdSchema.safeParse(Object.fromEntries(await event.request.formData()));
	if (!parsed.success) error(404, 'Not found');
	const result = await setTaskHidden(db, actor, event.params.id, parsed.data.taskId, hide, {
		send: sendMail,
		siteUrl: PUBLIC_SITE_URL,
		ip: event.getClientAddress()
	});
	if (result === 'not_found') error(404, 'Not found');
	if (result === 'not_allowed') error(403, 'Forbidden');
	if (result === 'bad_state') return fail(400, { stateError: true as const });
	return { saved: true as const };
}

export const actions: Actions = {
	hide: (event) => hidden(event, true),
	restore: (event) => hidden(event, false)
};
