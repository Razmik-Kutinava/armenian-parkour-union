import { redirect } from '@sveltejs/kit';
import { requirePermission } from '#lib/server/auth/guard.ts';
import { db } from '#lib/server/db/index.ts';
import { createItem } from '#lib/server/services/shop/items.ts';
import { imageChoices, readItemForm, refused } from '../form';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals }) => {
	requirePermission(locals.user, 'shop.items_write');
	return imageChoices();
};

export const actions: Actions = {
	default: async (event) => {
		const actor = requirePermission(event.locals.user, 'shop.items_write');
		const form = await readItemForm(event.request);
		if (form.failure) return form.failure;
		const result = await createItem(db, actor, form.values, event.getClientAddress());
		if (typeof result === 'string') return refused(result, form.raw);
		redirect(303, `/admin/products/${result.id}`);
	}
};
