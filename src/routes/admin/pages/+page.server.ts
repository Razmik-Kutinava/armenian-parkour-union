import { requirePermission } from '#lib/server/auth/guard.ts';
import { db } from '#lib/server/db/index.ts';
import { listPages } from '#lib/server/services/pages/list.ts';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals }) => {
	requirePermission(locals.user, 'pages.write');
	return { rows: await listPages(db) };
};
