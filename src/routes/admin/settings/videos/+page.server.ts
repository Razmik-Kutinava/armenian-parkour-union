import { error, fail } from '@sveltejs/kit';
import { requirePermission } from '#lib/server/auth/guard.ts';
import { db } from '#lib/server/db/index.ts';
import { saveVideoSettings, videoSettings } from '#lib/server/services/videos/settings.ts';
import { fieldErrors } from '#lib/validation/form.ts';
import { videoSettingsFormSchema } from '#lib/validation/videos.ts';
import type { Actions, PageServerLoad } from './$types';

/* docs/05 section 21 "Rule parameters": the monthly limit and the platforms of member videos. */
export const load: PageServerLoad = async ({ locals }) => {
	requirePermission(locals.user, 'settings.write');
	const settings = await videoSettings(db);
	return { values: { monthlyLimit: String(settings.monthlyLimit), platforms: settings.platforms } };
};

export const actions: Actions = {
	default: async (event) => {
		const actor = requirePermission(event.locals.user, 'settings.write');
		const form = await event.request.formData();
		const limit = form.get('monthlyLimit');
		const values = {
			monthlyLimit: typeof limit === 'string' ? limit : '',
			platforms: form.getAll('platforms').map(String)
		};
		const parsed = videoSettingsFormSchema.safeParse(values);
		if (!parsed.success) return fail(400, { values, errors: fieldErrors(parsed.error) });
		const result = await saveVideoSettings(db, actor, parsed.data, event.getClientAddress());
		if (result !== 'ok') error(403, 'Forbidden');
		return { saved: true as const, values };
	}
};
