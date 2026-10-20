import { error, fail, redirect } from '@sveltejs/kit';
import type { MessageKey } from '#lib/i18n/translate.ts';
import { requirePermission } from '#lib/server/auth/guard.ts';
import { db } from '#lib/server/db/index.ts';
import { listActivePurposes } from '#lib/server/services/donations/purposes.ts';
import { recordManual } from '#lib/server/services/payments/admin/index.ts';
import { manualPaymentSchema } from '#lib/validation/admin-payments.ts';
import { fieldErrors, keepValues } from '#lib/validation/form.ts';
import type { Actions, PageServerLoad } from './$types';

const FIELDS = [
	'kind',
	'amount',
	'currency',
	'paidOn',
	'comment',
	'payerEmail',
	'donorName',
	'donorEmail',
	'isAnonymous',
	'purposeId'
] as const;

/* Service refusals shown at their field. */
const refusals: Record<string, [string, MessageKey]> = {
	payer_required: ['payerEmail', 'payments.error.payer'],
	payer_not_found: ['payerEmail', 'payments.error.payerNotFound'],
	purpose_invalid: ['purposeId', 'payments.error.purpose'],
	future_date: ['paidOn', 'payments.error.date']
};

export const load: PageServerLoad = async ({ locals }) => {
	requirePermission(locals.user, 'payments.manage');
	return { purposes: await listActivePurposes(db, locals.locale) };
};

export const actions: Actions = {
	default: async (event) => {
		const actor = requirePermission(event.locals.user, 'payments.manage');
		const form = await event.request.formData();
		const values = keepValues(form, FIELDS);
		const parsed = manualPaymentSchema().safeParse(Object.fromEntries(form));
		if (!parsed.success) return fail(400, { values, errors: fieldErrors(parsed.error) });
		const result = await recordManual(db, actor, parsed.data, event.getClientAddress());
		if (result.ok) redirect(303, `/admin/payments/${result.paymentId}?created`);
		if (result.reason === 'not_allowed') error(403, 'Forbidden');
		const [field, message] = refusals[result.reason];
		return fail(400, { values, errors: { [field]: message } });
	}
};
