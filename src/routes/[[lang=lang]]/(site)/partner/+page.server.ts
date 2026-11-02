import { db } from '#lib/server/db/index.ts';
import { CASHIER_COOKIE, findCashier } from '#lib/server/services/volunteer/cashier-access.ts';
import type { PageServerLoad } from './$types';

/* docs/06 section 4.13: is this phone a cashier now. Disabled or re-linked — not bound. */
export const load: PageServerLoad = async ({ cookies, setHeaders }) => {
	setHeaders({ 'cache-control': 'no-store', 'x-robots-tag': 'noindex' });
	const cashier = await findCashier(db, cookies.get(CASHIER_COOKIE));
	return { cashier: cashier && { partnerName: cashier.partnerName, label: cashier.label } };
};
