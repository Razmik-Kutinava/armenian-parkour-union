import { readListState } from '#lib/components/admin/list-state.ts';
import { can } from '#lib/server/auth/permissions.ts';
import { requirePermission } from '#lib/server/auth/guard.ts';
import { db } from '#lib/server/db/index.ts';
import {
	listPayments,
	paymentListOptions,
	paymentProviderOptions
} from '#lib/server/services/payments/admin/index.ts';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals, url }) => {
	const user = requirePermission(locals.user, 'payments.read');
	const state = readListState(url.searchParams, paymentListOptions);
	const [{ rows, total }, providers] = await Promise.all([
		listPayments(db, state),
		paymentProviderOptions(db)
	]);
	return { state, rows, total, providers, canManage: can(user, 'payments.manage') };
};
