import { error, fail } from '@sveltejs/kit';
import { requireUser } from '#lib/server/auth/guard.ts';
import { db } from '#lib/server/db/index.ts';
import { getOwnOrder } from '#lib/server/services/cabinet/orders.ts';
import { cancelOwnOrderNow } from '#lib/server/services/shop/orders-now.ts';
import type { Actions, PageServerLoad } from './$types';

/* docs/06 section 5.8: the card of the member's own order; another member's is 404 (docs/04
 * section 5.3). Cancel — only a new order (question 108, decisions.md 2026-10-25). */
export const load: PageServerLoad = async ({ locals, params, setHeaders }) => {
	const user = requireUser(locals.user);
	const order = await getOwnOrder(db, user.id, params.id);
	if (!order) error(404, 'Not found');
	setHeaders({ 'cache-control': 'no-store' });
	return { order };
};

export const actions: Actions = {
	cancel: async (event) => {
		const user = requireUser(event.locals.user);
		const result = await cancelOwnOrderNow(db, user.id, event.params.id, event.getClientAddress());
		if (result === 'not_found') error(404, 'Not found');
		if (result !== 'ok') return fail(400, { cancelLate: true as const });
		return { cancelled: true as const };
	}
};
