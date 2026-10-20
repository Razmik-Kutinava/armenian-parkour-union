import { requirePermission } from '#lib/server/auth/guard.ts';
import { db } from '#lib/server/db/index.ts';
import { listPurposesAdmin } from '#lib/server/services/donations/purposes-admin.ts';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals }) => {
	requirePermission(locals.user, 'donations.config');
	return { purposes: await listPurposesAdmin(db) };
};
