import { error } from '@sveltejs/kit';
import { requirePermission } from '#lib/server/auth/guard.ts';
import { db } from '#lib/server/db/index.ts';
import { attemptDetail } from '#lib/server/services/training/attempt-card.ts';
import type { PageServerLoad } from './$types';

/* docs/05 section 27 "Attempts": the snapshot with the answers; nothing changes here. */
export const load: PageServerLoad = async ({ locals, params }) => {
	requirePermission(locals.user, 'training.review');
	const card = await attemptDetail(db, params.id);
	if (!card) error(404, 'Not found');
	return { card };
};
