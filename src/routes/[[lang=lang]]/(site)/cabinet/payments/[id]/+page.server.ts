import { error } from '@sveltejs/kit';
import { requireUser } from '#lib/server/auth/guard.ts';
import { db } from '#lib/server/db/index.ts';
import { getOwnReceipt } from '#lib/server/services/cabinet/receipt.ts';
import type { PageServerLoad } from './$types';

/* docs/07 section 12 p. 1: a copy of the receipt; another member's payment is 404 (docs/04 section 5.3). */
export const load: PageServerLoad = async ({ locals, params, setHeaders }) => {
	const user = requireUser(locals.user);
	const receipt = await getOwnReceipt(db, user.id, params.id, locals.locale);
	if (!receipt) error(404, 'Not found');
	setHeaders({ 'cache-control': 'no-store' });
	return { receipt };
};
