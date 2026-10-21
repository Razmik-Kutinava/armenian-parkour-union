import { error, fail } from '@sveltejs/kit';
import { requirePermission } from '#lib/server/auth/guard.ts';
import { db } from '#lib/server/db/index.ts';
import { getRule, updateRule } from '#lib/server/services/points/rules-admin.ts';
import { ruleFormSchema } from '#lib/validation/admin-point-rules.ts';
import { flattenValues, formToObject, settingsErrors } from '#lib/validation/site-settings-form.ts';
import type { Actions, PageServerLoad } from './$types';

/* docs/05 section 13: title ×3, points, active; the code is shown, never taken from the form. */
export const load: PageServerLoad = async ({ locals, params }) => {
	requirePermission(locals.user, 'points.rules');
	const rule = await getRule(db, params.id);
	if (!rule) error(404, 'Not found');
	return { rule };
};

export const actions: Actions = {
	default: async (event) => {
		const actor = requirePermission(event.locals.user, 'points.rules');
		const raw = formToObject(await event.request.formData());
		const parsed = ruleFormSchema.safeParse(raw);
		if (!parsed.success) {
			return fail(400, { values: flattenValues(raw), errors: settingsErrors(parsed.error) });
		}
		const result = await updateRule(db, actor, event.params.id, parsed.data, {
			ip: event.getClientAddress()
		});
		if (result === 'not_found') error(404, 'Not found');
		if (result === 'not_allowed') error(403, 'Forbidden');
		if (result === 'invalid') error(400, 'Bad request');
		return { saved: true as const };
	}
};
