import { requireStaff } from '#lib/server/auth/guard.ts';
import { db } from '#lib/server/db/index.ts';
import { getDashboard } from '#lib/server/services/dashboard/index.ts';
import type { PageServerLoad } from './$types';

/* docs/05 section 3: every staff role opens the dashboard; the service drops blocks by permission. */
export const load: PageServerLoad = async ({ locals }) => {
	const viewer = requireStaff(locals.user);
	return { dashboard: await getDashboard(db, viewer) };
};
