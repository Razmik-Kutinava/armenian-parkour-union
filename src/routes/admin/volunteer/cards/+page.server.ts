import { readListState } from '#lib/components/admin/list-state.ts';
import { requirePermission } from '#lib/server/auth/guard.ts';
import { db } from '#lib/server/db/index.ts';
import {
	cardFilter,
	cardListOptions,
	listCards
} from '#lib/server/services/volunteer/cards-admin.ts';
import type { PageServerLoad } from './$types';

/* docs/05 section 28 "Cards" (admin): the queue; decisions are on the card page. */
export const load: PageServerLoad = async ({ locals, url }) => {
	requirePermission(locals.user, 'volunteer.manage');
	const read = readListState(url.searchParams, cardListOptions);
	const filter = cardFilter(read);
	const state = { ...read, filters: { ...read.filters, status: filter.status } };
	const { rows, total } = await listCards(db, filter);
	return { state, rows, total };
};
