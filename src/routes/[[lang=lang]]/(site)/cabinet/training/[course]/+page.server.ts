import { error } from '@sveltejs/kit';
import { requireUser } from '#lib/server/auth/guard.ts';
import { db } from '#lib/server/db/index.ts';
import { portalOverview } from '#lib/server/services/training/portal.ts';
import type { PageServerLoad } from './$types';

/* docs/06 section 5.11 "Portal": no access and no course look the same — 404. */
export const load: PageServerLoad = async ({ locals, params, setHeaders }) => {
	const user = requireUser(locals.user);
	const portal = await portalOverview(db, user, params.course);
	if (!portal) error(404, 'Not found');
	setHeaders({ 'cache-control': 'no-store' });
	return { portal };
};
