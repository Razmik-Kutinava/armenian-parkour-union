import { error } from '@sveltejs/kit';
import { requirePermission } from '#lib/server/auth/guard.ts';
import { db } from '#lib/server/db/index.ts';
import { saveSiteLocales, siteLocales } from '#lib/server/services/site-locales.ts';
import type { Actions, PageServerLoad } from './$types';

/* docs/06 section 1 p. 2: Armenian and Russian are switched on as translations get ready. */
export const load: PageServerLoad = async ({ locals }) => {
	requirePermission(locals.user, 'settings.write');
	return { enabled: await siteLocales(db) };
};

export const actions: Actions = {
	default: async (event) => {
		const actor = requirePermission(event.locals.user, 'settings.write');
		const codes = (await event.request.formData()).getAll('locales');
		const result = await saveSiteLocales(db, actor, codes, event.getClientAddress());
		if (result !== 'ok') error(403, 'Forbidden');
		return { saved: true as const, enabled: await siteLocales(db) };
	}
};
