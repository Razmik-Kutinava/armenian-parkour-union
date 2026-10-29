import { error } from '@sveltejs/kit';
import { requirePermission } from '#lib/server/auth/guard.ts';
import { db } from '#lib/server/db/index.ts';
import { getPartner } from '#lib/server/services/volunteer/partners-admin.ts';
import type { LayoutServerLoad } from './$types';

/* The partner header and its tabs; each page and action checks the permission itself too. */
export const load: LayoutServerLoad = async ({ locals, params }) => {
	requirePermission(locals.user, 'volunteer.manage');
	const partner = await getPartner(db, params.id);
	if (!partner) error(404, 'Not found');
	return { partner };
};
