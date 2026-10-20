import { requireUser } from '#lib/server/auth/guard.ts';
import { db } from '#lib/server/db/index.ts';
import { listOwnPayments } from '#lib/server/services/cabinet/payments.ts';
import type { PageServerLoad } from './$types';

/* docs/06 section 5.9: own payments only; the user id comes from the session. */
export const load: PageServerLoad = async ({ locals, setHeaders }) => {
	const user = requireUser(locals.user);
	setHeaders({ 'cache-control': 'no-store' });
	return { payments: await listOwnPayments(db, user.id) };
};
