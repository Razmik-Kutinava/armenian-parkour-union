import { error } from '@sveltejs/kit';
import { requirePermission } from '#lib/server/auth/guard.ts';
import { db } from '#lib/server/db/index.ts';
import { getPerk, updatePerk } from '#lib/server/services/volunteer/perks-admin.ts';
import { perkFormValues, readPerkForm } from '../../../form';
import type { Actions, PageServerLoad } from './$types';

/* docs/05 section 28 "Perks": the perk form; a perk of another partner is not found. */
export const load: PageServerLoad = async ({ locals, params }) => {
	requirePermission(locals.user, 'volunteer.manage');
	const perk = await getPerk(db, params.id, params.perkId);
	if (!perk) error(404, 'Not found');
	return { perk: { id: perk.id, title: perk.title }, values: perkFormValues(perk) };
};

export const actions: Actions = {
	update: async (event) => {
		const actor = requirePermission(event.locals.user, 'volunteer.manage');
		const form = await readPerkForm(event.request);
		if (form.failure) return form.failure;
		const { id, perkId } = event.params;
		const ip = event.getClientAddress();
		const result = await updatePerk(db, actor, id, perkId, form.values, ip);
		if (result === 'not_found') error(404, 'Not found');
		if (result === 'not_allowed') error(403, 'Forbidden');
		return { saved: true as const };
	}
};
