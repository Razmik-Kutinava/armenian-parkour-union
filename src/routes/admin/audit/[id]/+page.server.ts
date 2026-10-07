import { error } from '@sveltejs/kit';
import { requirePermission } from '#lib/server/auth/guard.ts';
import { db } from '#lib/server/db/index.ts';
import { getAuditEntry } from '#lib/server/services/audit.ts';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals, params }) => {
	requirePermission(locals.user, 'audit.read');
	const entry = await getAuditEntry(db, params.id);
	if (!entry) error(404, 'Not found');
	return { entry };
};
