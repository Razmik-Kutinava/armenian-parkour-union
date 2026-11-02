import { error, fail } from '@sveltejs/kit';
import { readListState } from '#lib/components/admin/list-state.ts';
import type { MessageKey } from '#lib/i18n/translate.ts';
import { requirePermission } from '#lib/server/auth/guard.ts';
import { db } from '#lib/server/db/index.ts';
import { listPartnersAdmin } from '#lib/server/services/volunteer/partner-list.ts';
import { reversePerk } from '#lib/server/services/volunteer/perk-reverse.ts';
import {
	listRedemptions,
	redemptionsListOptions,
	redemptionsSummary
} from '#lib/server/services/volunteer/redemptions-admin.ts';
import { reversePerkSchema } from '#lib/validation/volunteer-redemptions.ts';
import type { Actions, PageServerLoad } from './$types';

/* docs/05 section 28 "Redemptions": journal, summary, reverse. */

const REFUSED: Record<string, MessageKey> = {
	invalid: 'volunteer.redemptions.error.comment',
	not_found: 'volunteer.redemptions.error.gone',
	not_reversible: 'volunteer.redemptions.error.notReversible',
	already_reversed: 'volunteer.redemptions.error.already'
};

export const load: PageServerLoad = async ({ locals, url }) => {
	requirePermission(locals.user, 'volunteer.manage');
	const state = readListState(url.searchParams, redemptionsListOptions);
	const [{ rows, total }, summary, partners] = await Promise.all([
		listRedemptions(db, state),
		redemptionsSummary(db, state),
		listPartnersAdmin(db)
	]);
	return {
		state,
		rows,
		total,
		summary,
		partners: partners.map((p) => ({ id: p.id, name: p.name }))
	};
};

export const actions: Actions = {
	reverse: async (event) => {
		const actor = requirePermission(event.locals.user, 'volunteer.manage');
		const form = Object.fromEntries(await event.request.formData());
		const parsed = reversePerkSchema.safeParse(form);
		if (!parsed.success) {
			const badId = parsed.error.issues.some((i) => i.path[0] === 'redemptionId');
			return fail(400, {
				message: REFUSED[badId ? 'not_found' : 'invalid']
			});
		}
		const result = await reversePerk(db, actor, parsed.data, {
			ip: event.getClientAddress()
		});
		if (result.ok) return { reversed: true as const };
		if (result.reason === 'not_allowed') error(403, 'Forbidden');
		return fail(result.reason === 'not_found' ? 404 : 400, {
			message: REFUSED[result.reason]
		});
	}
};
