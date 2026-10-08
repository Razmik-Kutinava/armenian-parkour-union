import { redirect } from '@sveltejs/kit';
import { requirePermission } from '#lib/server/auth/guard.ts';
import { db } from '#lib/server/db/index.ts';
import { createEvent } from '#lib/server/services/events/edit.ts';
import { coverChoices, readEventForm, refused } from '../form';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals }) => {
	requirePermission(locals.user, 'events.write');
	return coverChoices();
};

export const actions: Actions = {
	default: async (event) => {
		const actor = requirePermission(event.locals.user, 'events.write');
		const form = await readEventForm(event.request);
		if (form.failure) return form.failure;
		const result = await createEvent(db, actor, form.values, event.getClientAddress());
		if (typeof result === 'string') return refused(result, form.raw);
		redirect(303, `/admin/events/${result.id}`);
	}
};
