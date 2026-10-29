import { requirePermission } from '#lib/server/auth/guard.ts';
import { db } from '#lib/server/db/index.ts';
import { listPerks } from '#lib/server/services/volunteer/perks-admin.ts';
import type { PageServerLoad } from './$types';

/* docs/05 section 28 "Perks" tab: every perk of the partner, archived too, in their order. */
export const load: PageServerLoad = async ({ locals, params }) => {
	requirePermission(locals.user, 'volunteer.manage');
	return { perks: await listPerks(db, params.id) };
};
