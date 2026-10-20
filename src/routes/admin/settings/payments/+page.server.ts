import { error, fail } from '@sveltejs/kit';
import { requirePermission } from '#lib/server/auth/guard.ts';
import { db } from '#lib/server/db/index.ts';
import { getPaymentSettings, savePaymentSettings } from '#lib/server/services/payment-settings.ts';
import { fieldErrors, keepValues } from '#lib/validation/form.ts';
import {
	PAYMENT_SETTINGS_FIELDS,
	paymentSettingsFormSchema,
	paymentSettingsToForm
} from '#lib/validation/payment-settings.ts';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals }) => {
	requirePermission(locals.user, 'settings.write');
	return { values: paymentSettingsToForm(await getPaymentSettings(db)) };
};

export const actions: Actions = {
	default: async (event) => {
		const actor = requirePermission(event.locals.user, 'settings.write');
		const form = await event.request.formData();
		const values = keepValues(form, PAYMENT_SETTINGS_FIELDS);
		const parsed = paymentSettingsFormSchema.safeParse(Object.fromEntries(form));
		if (!parsed.success) return fail(400, { values, errors: fieldErrors(parsed.error) });
		const result = await savePaymentSettings(db, actor, parsed.data, event.getClientAddress());
		if (result !== 'ok') error(403, 'Forbidden');
		return { saved: true as const, values: paymentSettingsToForm(parsed.data) };
	}
};
