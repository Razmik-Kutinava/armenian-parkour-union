import { error, redirect } from '@sveltejs/kit';
import { requirePermission } from '#lib/server/auth/guard.ts';
import { db } from '#lib/server/db/index.ts';
import { createPerk } from '#lib/server/services/volunteer/perks-admin.ts';
import { readPerkForm } from '../../../form';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = ({ locals }) => {
	requirePermission(locals.user, 'volunteer.manage');
};

export const actions: Actions = {
	default: async (event) => {
		const actor = requirePermission(event.locals.user, 'volunteer.manage');
		const form = await readPerkForm(event.request);
		if (form.failure) return form.failure;
		const { id } = event.params;
		const result = await createPerk(db, actor, id, form.values, event.getClientAddress());
		if (result === 'not_found') error(404, 'Not found');
		if (result === 'not_allowed') error(403, 'Forbidden');
		redirect(303, `/admin/volunteer/partners/${id}/perks/${result.id}`);
	}
};
