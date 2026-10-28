import { error } from '@sveltejs/kit';
import { requirePermission } from '#lib/server/auth/guard.ts';
import { db } from '#lib/server/db/index.ts';
import { accessDetail } from '#lib/server/services/training/access-card.ts';
import type { PageServerLoad } from './$types';

/* docs/05 section 27 "Requests": the member card — attempts, practice, the exam; nothing changes here. */
export const load: PageServerLoad = async ({ locals, params }) => {
	requirePermission(locals.user, 'training.manage');
	const card = await accessDetail(db, params.id);
	if (!card) error(404, 'Not found');
	return { card };
};
