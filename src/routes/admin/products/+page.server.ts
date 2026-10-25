import { readListState } from '#lib/components/admin/list-state.ts';
import { requirePermission } from '#lib/server/auth/guard.ts';
import { db } from '#lib/server/db/index.ts';
import { itemListOptions, listItems } from '#lib/server/services/shop/item-list.ts';
import { publicUrl } from '#lib/server/storage/r2.ts';
import type { PageServerLoad } from './$types';

/* docs/05 section 14: editor and admin. */
export const load: PageServerLoad = async ({ locals, url }) => {
	requirePermission(locals.user, 'shop.items_write');
	const state = readListState(url.searchParams, itemListOptions);
	const { rows, total } = await listItems(db, state);
	return {
		state,
		total,
		rows: rows.map(({ imageKeys, ...r }) => ({
			...r,
			photoUrl: imageKeys[0] ? publicUrl(imageKeys[0]) : null
		}))
	};
};
