import { requirePermission } from '#lib/server/auth/guard.ts';
import { db } from '#lib/server/db/index.ts';
import { updatePartner } from '#lib/server/services/volunteer/partners-admin.ts';
import { imageChoices, partnerFormValues, readPartnerForm, refused } from '../form';
import type { Actions, PageServerLoad } from './$types';

/* docs/05 section 28 "Partners": the form; status draft / published / archived, no deletion. */
export const load: PageServerLoad = async ({ locals, parent }) => {
	requirePermission(locals.user, 'volunteer.manage');
	const { partner } = await parent();
	return { ...(await imageChoices()), values: partnerFormValues(partner) };
};

export const actions: Actions = {
	update: async (event) => {
		const actor = requirePermission(event.locals.user, 'volunteer.manage');
		const form = await readPartnerForm(event.request);
		if (form.failure) return form.failure;
		const ip = event.getClientAddress();
		const result = await updatePartner(db, actor, event.params.id, form.values, ip);
		if (result !== 'ok') return refused(result, form.raw);
		return { saved: true as const };
	}
};
