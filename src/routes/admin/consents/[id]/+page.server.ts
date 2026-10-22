import { error, fail } from '@sveltejs/kit';
import type { MessageKey } from '#lib/i18n/translate.ts';
import { requirePermission } from '#lib/server/auth/guard.ts';
import { db } from '#lib/server/db/index.ts';
import {
	approve,
	getConsentCard,
	reject,
	type ReviewResult
} from '#lib/server/services/consents/index.ts';
import { r2Private } from '#lib/server/storage/r2.ts';
import { approveSchema, rejectSchema } from '#lib/validation/consents.ts';
import type { Actions, PageServerLoad } from './$types';

/* docs/05 section 10: the card and the decision; moderator and admin. */
export const load: PageServerLoad = async ({ locals, params }) => {
	const viewer = requirePermission(locals.user, 'consents.review');
	const card = await getConsentCard(db, viewer, r2Private, params.id);
	if (!card) error(404, 'Not found');
	return { card };
};

function outcome(result: ReviewResult) {
	if (result === 'not_found') error(404, 'Not found');
	if (result === 'not_allowed') error(403, 'Forbidden');
	if (result === 'wrong_status')
		return fail(400, { message: 'consents.error.wrongStatus' as MessageKey });
	return { done: 'consents.saved' as MessageKey };
}

const formOf = async (request: Request) => Object.fromEntries(await request.formData());

export const actions: Actions = {
	approve: async ({ locals, params, request, getClientAddress }) => {
		const actor = requirePermission(locals.user, 'consents.review');
		const parsed = approveSchema().safeParse(await formOf(request));
		if (!parsed.success) {
			return fail(400, { message: parsed.error.issues[0].message as MessageKey });
		}
		return outcome(await approve(db, actor, params.id, parsed.data, getClientAddress()));
	},
	reject: async ({ locals, params, request, getClientAddress }) => {
		const actor = requirePermission(locals.user, 'consents.review');
		const parsed = rejectSchema.safeParse(await formOf(request));
		if (!parsed.success) {
			return fail(400, { message: parsed.error.issues[0].message as MessageKey });
		}
		return outcome(await reject(db, actor, params.id, parsed.data, getClientAddress()));
	}
};
