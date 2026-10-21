import { fail } from '@sveltejs/kit';
import { readListState } from '#lib/components/admin/list-state.ts';
import { can } from '#lib/server/auth/permissions.ts';
import { requirePermission } from '#lib/server/auth/guard.ts';
import { db } from '#lib/server/db/index.ts';
import { listPoints, pointsListOptions } from '#lib/server/services/points/admin-list.ts';
import { reverseEntry } from '#lib/server/services/points/reverse.ts';
import { reverseSchema } from '#lib/validation/admin-points.ts';
import { refusalMessage } from './outcome';
import type { Actions, PageServerLoad } from './$types';

/* docs/05 section 12: moderator reads the ledger, admin also reverses entries. */
export const load: PageServerLoad = async ({ locals, url }) => {
	const user = requirePermission(locals.user, 'points.read');
	const state = readListState(url.searchParams, pointsListOptions);
	const { rows, total } = await listPoints(db, state);
	return { state, rows, total, canAdjust: can(user, 'points.adjust') };
};

export const actions: Actions = {
	reverse: async (event) => {
		const actor = requirePermission(event.locals.user, 'points.adjust');
		const form = Object.fromEntries(await event.request.formData());
		const parsed = reverseSchema.safeParse(form);
		if (!parsed.success) {
			const badEntry = parsed.error.issues.some((i) => i.path[0] === 'entryId');
			return fail(400, { message: refusalMessage(badEntry ? 'not_found' : 'invalid') });
		}
		const result = await reverseEntry(db, actor, parsed.data, { ip: event.getClientAddress() });
		if (result.ok) return { reversed: { balance: result.balance } };
		const status = result.reason === 'not_found' ? 404 : 400;
		return fail(status, { message: refusalMessage(result.reason) });
	}
};
