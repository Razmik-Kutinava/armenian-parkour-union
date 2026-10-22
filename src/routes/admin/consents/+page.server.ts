import { readListState } from '#lib/components/admin/list-state.ts';
import { requirePermission } from '#lib/server/auth/guard.ts';
import { db } from '#lib/server/db/index.ts';
import { consentListOptions, listConsents } from '#lib/server/services/consents/index.ts';
import type { PageServerLoad } from './$types';

/* docs/05 section 10: moderator and admin check consents. */
export const load: PageServerLoad = async ({ locals, url }) => {
	requirePermission(locals.user, 'consents.review');
	const state = readListState(url.searchParams, consentListOptions);
	const { rows, total } = await listConsents(db, state);
	return { state, rows, total };
};
