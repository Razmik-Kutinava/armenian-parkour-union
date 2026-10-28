import { error, fail, type RequestEvent } from '@sveltejs/kit';
import { can } from '#lib/server/auth/permissions.ts';
import { requirePermission } from '#lib/server/auth/guard.ts';
import { db } from '#lib/server/db/index.ts';
import { staffCanCancel } from '#lib/server/services/shop/order-cancel.ts';
import { getOrder } from '#lib/server/services/shop/order-list.ts';
import { setTrackingNote } from '#lib/server/services/shop/orders.ts';
import { cancelOrderNow, changeOrderStatusNow } from '#lib/server/services/shop/orders-now.ts';
import { trackingNoteSchema } from '#lib/validation/shop.ts';
import type { Actions, PageServerLoad } from './$types';

/* docs/05 section 15: the card, a status forward with a letter, the shipping note; the cancel with
 * a refund — admin only (docs/04 section 3.2). */
export const load: PageServerLoad = async ({ locals, params }) => {
	const staff = requirePermission(locals.user, 'shop.orders_manage');
	const order = await getOrder(db, params.id);
	if (!order) error(404, 'Not found');
	return { order, canCancel: can(staff, 'shop.orders_cancel') && staffCanCancel(order.status) };
};

function answer(result: 'ok' | 'bad_status' | 'not_found' | 'not_allowed') {
	if (result === 'not_found') error(404, 'Not found');
	if (result === 'not_allowed') error(403, 'Forbidden');
	if (result === 'bad_status') return fail(400, { badStatus: true as const });
	return { saved: true as const };
}

const actor = (event: RequestEvent) => requirePermission(event.locals.user, 'shop.orders_manage');

export const actions: Actions = {
	status: async (event) => {
		const staff = actor(event);
		const status = (await event.request.formData()).get('status');
		const ip = event.getClientAddress();
		const target = typeof status === 'string' ? status : '';
		return answer(await changeOrderStatusNow(db, staff, event.params.id, target, ip));
	},
	tracking: async (event) => {
		const staff = actor(event);
		const note = trackingNoteSchema.safeParse((await event.request.formData()).get('trackingNote'));
		if (!note.success) return fail(400, { badNote: true as const });
		const ip = event.getClientAddress();
		return answer(await setTrackingNote(db, staff, event.params.id, note.data, ip));
	},
	cancel: async (event) => {
		const admin = requirePermission(event.locals.user, 'shop.orders_cancel');
		const ip = event.getClientAddress();
		return answer(await cancelOrderNow(db, admin, event.params.id, ip));
	}
};
