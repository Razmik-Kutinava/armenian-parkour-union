import { readListState } from '#lib/components/admin/list-state.ts';
import { can } from '#lib/server/auth/permissions.ts';
import { requirePermission } from '#lib/server/auth/guard.ts';
import { db } from '#lib/server/db/index.ts';
import { listCities, listUsers, userListOptions } from '#lib/server/services/users/list.ts';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals, url }) => {
	const user = requirePermission(locals.user, 'users.read_limited');
	const state = readListState(url.searchParams, userListOptions);
	const [{ rows, total }, cities] = await Promise.all([
		listUsers(db, user, state),
		listCities(db, user)
	]);
	return {
		state,
		rows,
		total,
		cities,
		showEmail: can(user, 'users.read_full'),
		canCreate: can(user, 'users.write')
	};
};
