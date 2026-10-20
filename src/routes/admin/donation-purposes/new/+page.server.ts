import { error, redirect } from '@sveltejs/kit';
import { requirePermission } from '#lib/server/auth/guard.ts';
import { db } from '#lib/server/db/index.ts';
import { createPurpose } from '#lib/server/services/donations/purposes-admin.ts';
import { readPurposeForm } from '../form';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = ({ locals }) => {
	requirePermission(locals.user, 'donations.config');
};

export const actions: Actions = {
	default: async (event) => {
		const actor = requirePermission(event.locals.user, 'donations.config');
		const form = await readPurposeForm(event.request);
		if (form.failure) return form.failure;
		const result = await createPurpose(db, actor, form.values, event.getClientAddress());
		if (result === 'not_allowed') error(403, 'Forbidden');
		redirect(303, `/admin/donation-purposes/${result.id}`);
	}
};
