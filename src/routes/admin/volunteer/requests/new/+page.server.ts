import { redirect } from '@sveltejs/kit';
import { requirePermission } from '#lib/server/auth/guard.ts';
import { db } from '#lib/server/db/index.ts';
import { createRequest } from '#lib/server/services/volunteer/requests-admin.ts';
import { readRequestForm, refused } from '../form';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals }) => {
	requirePermission(locals.user, 'volunteer.manage');
	return {};
};

export const actions: Actions = {
	default: async (event) => {
		const actor = requirePermission(event.locals.user, 'volunteer.manage');
		const form = await readRequestForm(event.request);
		if (form.failure) return form.failure;
		const result = await createRequest(db, actor, form.values, event.getClientAddress());
		if (typeof result === 'string') return refused(result, form.raw);
		redirect(303, `/admin/volunteer/requests/${result.id}`);
	}
};
