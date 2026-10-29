import { redirect } from '@sveltejs/kit';
import { requirePermission } from '#lib/server/auth/guard.ts';
import { db } from '#lib/server/db/index.ts';
import { createPartner } from '#lib/server/services/volunteer/partners-admin.ts';
import { imageChoices, readPartnerForm, refused } from '../form';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals }) => {
	requirePermission(locals.user, 'volunteer.manage');
	return imageChoices();
};

export const actions: Actions = {
	default: async (event) => {
		const actor = requirePermission(event.locals.user, 'volunteer.manage');
		const form = await readPartnerForm(event.request);
		if (form.failure) return form.failure;
		const result = await createPartner(db, actor, form.values, event.getClientAddress());
		if (typeof result === 'string') return refused(result, form.raw);
		redirect(303, `/admin/volunteer/partners/${result.id}`);
	}
};
