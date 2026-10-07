import { error, fail } from '@sveltejs/kit';
import { requirePermission } from '#lib/server/auth/guard.ts';
import { db } from '#lib/server/db/index.ts';
import { getAdminSettings, saveSettings } from '#lib/server/services/site-settings.ts';
import {
	flattenValues,
	formToObject,
	settingsErrors,
	settingsFormSchema
} from '#lib/validation/site-settings-form.ts';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals }) => {
	requirePermission(locals.user, 'settings.write');
	return { values: flattenValues(await getAdminSettings(db)) };
};

export const actions: Actions = {
	default: async (event) => {
		const actor = requirePermission(event.locals.user, 'settings.write');
		const raw = formToObject(await event.request.formData());
		const parsed = settingsFormSchema.safeParse(raw);
		if (!parsed.success) {
			return fail(400, { values: flattenValues(raw), errors: settingsErrors(parsed.error) });
		}
		const result = await saveSettings(db, actor, parsed.data, event.getClientAddress());
		if (result !== 'ok') error(403, 'Forbidden');
		return { saved: true as const };
	}
};
