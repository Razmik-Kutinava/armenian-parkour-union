import { error } from '@sveltejs/kit';
import { readListState } from '#lib/components/admin/list-state.ts';
import { requireUser } from '#lib/server/auth/guard.ts';
import { db } from '#lib/server/db/index.ts';
import { getOwnPoints, howToEarn, ownPointsOptions } from '#lib/server/services/cabinet/points.ts';
import type { PageServerLoad } from './$types';

/* docs/06 section 5.6: own points only; the user id comes from the session (docs/04 section 5.3). */
export const load: PageServerLoad = async ({ locals, url, setHeaders }) => {
	const user = requireUser(locals.user);
	setHeaders({ 'cache-control': 'no-store' });
	const state = readListState(url.searchParams, ownPointsOptions);
	const [points, earn] = await Promise.all([
		getOwnPoints(db, user.id, state),
		howToEarn(db, locals.locale)
	]);
	if (!points) error(404);
	return { ...points, earn, state };
};
