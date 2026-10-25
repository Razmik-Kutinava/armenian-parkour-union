import { error, fail, redirect } from '@sveltejs/kit';
import { requirePermission } from '#lib/server/auth/guard.ts';
import { db } from '#lib/server/db/index.ts';
import { getItem } from '#lib/server/services/shop/item-list.ts';
import {
	changeItemStatus,
	duplicateItem,
	type ItemStatusAction
} from '#lib/server/services/shop/item-status.ts';
import { updateItem } from '#lib/server/services/shop/items.ts';
import { formValues, imageChoices, readItemForm, refused } from '../form';
import type { Actions, PageServerLoad } from './$types';

/* docs/05 section 14: save, publish / hide, archive / restore, duplicate. */
export const load: PageServerLoad = async ({ locals, params }) => {
	requirePermission(locals.user, 'shop.items_write');
	const item = await getItem(db, params.id);
	if (!item) error(404, 'Not found');
	const { id, title, status } = item;
	return { ...(await imageChoices()), item: { id, title, status }, values: formValues(item) };
};

const STATUS_ACTIONS: readonly string[] = ['publish', 'unpublish', 'archive', 'restore'];

const missing = (result: 'not_found' | 'not_allowed') =>
	result === 'not_found' ? error(404, 'Not found') : error(403, 'Forbidden');

export const actions: Actions = {
	update: async (event) => {
		const actor = requirePermission(event.locals.user, 'shop.items_write');
		const form = await readItemForm(event.request);
		if (form.failure) return form.failure;
		const ip = event.getClientAddress();
		const result = await updateItem(db, actor, event.params.id, form.values, ip);
		if (result !== 'ok') return refused(result, form.raw);
		return { saved: true as const };
	},
	status: async (event) => {
		const actor = requirePermission(event.locals.user, 'shop.items_write');
		const action = (await event.request.formData()).get('action');
		if (typeof action !== 'string' || !STATUS_ACTIONS.includes(action)) {
			return fail(400, { badStatus: true as const });
		}
		const ip = event.getClientAddress();
		const result = await changeItemStatus(
			db,
			actor,
			event.params.id,
			action as ItemStatusAction,
			ip
		);
		if (result === 'bad_status') return fail(400, { badStatus: true as const });
		if (result !== 'ok') missing(result);
		return { saved: true as const };
	},
	duplicate: async (event) => {
		const actor = requirePermission(event.locals.user, 'shop.items_write');
		const result = await duplicateItem(db, actor, event.params.id, event.getClientAddress());
		if (typeof result === 'string') missing(result);
		else redirect(303, `/admin/products/${result.id}`);
	}
};
