import { error } from '@sveltejs/kit';
import { requirePermission } from '#lib/server/auth/guard.ts';
import { db } from '#lib/server/db/index.ts';
import { getPurpose, updatePurpose } from '#lib/server/services/donations/purposes-admin.ts';
import { readPurposeForm } from '../form';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals, params }) => {
	requirePermission(locals.user, 'donations.config');
	const purpose = await getPurpose(db, params.id);
	if (!purpose) error(404, 'Not found');
	return { purpose };
};

export const actions: Actions = {
	update: async (event) => {
		const actor = requirePermission(event.locals.user, 'donations.config');
		const form = await readPurposeForm(event.request);
		if (form.failure) return form.failure;
		const result = await updatePurpose(
			db,
			actor,
			event.params.id,
			form.values,
			event.getClientAddress()
		);
		if (result === 'not_found') error(404, 'Not found');
		if (result === 'not_allowed') error(403, 'Forbidden');
		return { saved: true };
	}
};
