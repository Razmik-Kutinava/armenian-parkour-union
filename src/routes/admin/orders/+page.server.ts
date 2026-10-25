import { readListState } from '#lib/components/admin/list-state.ts';
import { requirePermission } from '#lib/server/auth/guard.ts';
import { db } from '#lib/server/db/index.ts';
import { listOrders, orderListOptions } from '#lib/server/services/shop/order-list.ts';
import type { PageServerLoad } from './$types';

/* docs/05 section 15: moderator and admin. */
export const load: PageServerLoad = async ({ locals, url }) => {
	requirePermission(locals.user, 'shop.orders_manage');
	const state = readListState(url.searchParams, orderListOptions);
	return { state, ...(await listOrders(db, state)) };
};
