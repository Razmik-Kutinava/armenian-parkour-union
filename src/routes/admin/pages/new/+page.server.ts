import { error, redirect } from '@sveltejs/kit';
import { requirePermission } from '#lib/server/auth/guard.ts';
import { db } from '#lib/server/db/index.ts';
import { createPage } from '#lib/server/services/pages/edit.ts';
import { readPageForm, slugTaken } from '../form';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = ({ locals }) => {
	requirePermission(locals.user, 'pages.write');
};

export const actions: Actions = {
	default: async (event) => {
		const actor = requirePermission(event.locals.user, 'pages.write');
		const form = await readPageForm(event.request);
		if (form.failure) return form.failure;
		const result = await createPage(db, actor, form.values, event.getClientAddress());
		if (result === 'slug_taken') return slugTaken(form.raw);
		if (result === 'not_allowed') error(403, 'Forbidden');
		redirect(303, `/admin/pages/${result.id}`);
	}
};
