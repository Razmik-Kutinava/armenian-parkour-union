import { error } from '@sveltejs/kit';
import { can } from '#lib/server/auth/permissions.ts';
import { requirePermission } from '#lib/server/auth/guard.ts';
import { db } from '#lib/server/db/index.ts';
import {
	confirmManually,
	paymentCard,
	refund,
	resendPaymentReceipt,
	resolveReview
} from '#lib/server/services/payments/admin/index.ts';
import { commentSchema } from '#lib/validation/admin-payments.ts';
import { paymentOutcome } from '../outcome';
import type { Actions, PageServerLoad, RequestEvent } from './$types';

export const load: PageServerLoad = async ({ locals, params, url }) => {
	const user = requirePermission(locals.user, 'payments.read');
	const card = await paymentCard(db, params.id);
	if (!card) error(404, 'Not found');
	return {
		card,
		created: url.searchParams.has('created'),
		canManage: can(user, 'payments.manage')
	};
};

/** The comment of the confirm dialog; empty — the service answers `invalid`. */
async function comment(event: RequestEvent): Promise<string> {
	const parsed = commentSchema.safeParse(Object.fromEntries(await event.request.formData()));
	return parsed.success ? parsed.data.comment : '';
}

export const actions: Actions = {
	confirm: async (event) => {
		const actor = requirePermission(event.locals.user, 'payments.manage');
		const text = await comment(event);
		const ip = event.getClientAddress();
		return paymentOutcome(await confirmManually(db, actor, event.params.id, text, ip));
	},
	refund: async (event) => {
		const actor = requirePermission(event.locals.user, 'payments.manage');
		const text = await comment(event);
		return paymentOutcome(await refund(db, actor, event.params.id, text, event.getClientAddress()));
	},
	resolve: async (event) => {
		const actor = requirePermission(event.locals.user, 'payments.manage');
		const text = await comment(event);
		const ip = event.getClientAddress();
		return paymentOutcome(await resolveReview(db, actor, event.params.id, text, ip));
	},
	receipt: async (event) => {
		const actor = requirePermission(event.locals.user, 'payments.manage');
		const result = await resendPaymentReceipt(db, actor, event.params.id, event.getClientAddress());
		return paymentOutcome(result, 'payments.mailed');
	}
};
