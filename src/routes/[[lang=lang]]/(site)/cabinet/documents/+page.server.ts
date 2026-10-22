import { error } from '@sveltejs/kit';
import { requireUser } from '#lib/server/auth/guard.ts';
import { db } from '#lib/server/db/index.ts';
import { getOwnConsents } from '#lib/server/services/consents/index.ts';
import { r2Private } from '#lib/server/storage/r2.ts';
import type { Actions, PageServerLoad } from './$types';
import { consentActions } from './consent-actions';

/* docs/06 section 5.10: own consents only (docs/04 section 5.3); files by a short signed link. */
export const load: PageServerLoad = async ({ locals }) => {
	const user = requireUser(locals.user);
	const consents = await getOwnConsents(db, r2Private, user.id);
	if (!consents) error(404);
	return { consents };
};

export const actions: Actions = consentActions;
