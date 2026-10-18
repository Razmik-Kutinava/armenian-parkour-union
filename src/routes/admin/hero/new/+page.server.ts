import { redirect } from '@sveltejs/kit';
import { requirePermission } from '#lib/server/auth/guard.ts';
import { db } from '#lib/server/db/index.ts';
import { createHeroBlock } from '#lib/server/services/hero/edit.ts';
import { heroChoices, readHeroForm, refused } from '../form';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals }) => {
	requirePermission(locals.user, 'hero.write');
	return heroChoices(null, null);
};

export const actions: Actions = {
	default: async (event) => {
		const actor = requirePermission(event.locals.user, 'hero.write');
		const form = await readHeroForm(event.request);
		if (form.failure) return form.failure;
		const result = await createHeroBlock(db, actor, form.values, event.getClientAddress());
		if (typeof result === 'string') return refused(result, form.raw);
		redirect(303, `/admin/hero/${result.id}`);
	}
};
