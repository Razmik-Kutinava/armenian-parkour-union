import { error, fail } from '@sveltejs/kit';
import { requirePermission } from '#lib/server/auth/guard.ts';
import { can } from '#lib/server/auth/permissions.ts';
import { db } from '#lib/server/db/index.ts';
import { listRules } from '#lib/server/services/points/rules-admin.ts';
import { readSuspicious, saveSuspicious } from '#lib/server/services/points/suspicious.ts';
import {
	THRESHOLD_FIELDS,
	thresholdsFormSchema,
	thresholdsToForm
} from '#lib/validation/admin-point-rules.ts';
import { fieldErrors, keepValues } from '#lib/validation/form.ts';
import type { Actions, PageServerLoad } from './$types';

/* docs/05 section 13 and the thresholds of "suspicious" (decisions.md 2026-10-21): the moderator
 * reads them, only the admin changes them. */
export const load: PageServerLoad = async ({ locals }) => {
	const user = requirePermission(locals.user, 'points.read');
	const [rules, thresholds] = await Promise.all([listRules(db), readSuspicious(db)]);
	return { rules, thresholds: thresholdsToForm(thresholds), canEdit: can(user, 'points.rules') };
};

export const actions: Actions = {
	thresholds: async (event) => {
		const actor = requirePermission(event.locals.user, 'points.rules');
		const form = await event.request.formData();
		const values = keepValues(form, THRESHOLD_FIELDS);
		const parsed = thresholdsFormSchema.safeParse(Object.fromEntries(form));
		if (!parsed.success) return fail(400, { values, errors: fieldErrors(parsed.error) });
		const result = await saveSuspicious(db, actor, parsed.data, event.getClientAddress());
		if (result === 'not_allowed') error(403, 'Forbidden');
		if (result === 'invalid') error(400, 'Bad request');
		return { saved: true as const, values: thresholdsToForm(parsed.data) };
	}
};
