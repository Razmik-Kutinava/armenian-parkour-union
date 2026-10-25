import { requireUser } from '#lib/server/auth/guard.ts';
import { db } from '#lib/server/db/index.ts';
import { listOwnOrders } from '#lib/server/services/cabinet/orders.ts';
import type { PageServerLoad } from './$types';

/* docs/06 section 5.8: own orders only; the user comes from the session (docs/04 section 5.3). */
export const load: PageServerLoad = async ({ locals, setHeaders }) => {
	const user = requireUser(locals.user);
	setHeaders({ 'cache-control': 'no-store' });
	return { orders: await listOwnOrders(db, user.id) };
};
