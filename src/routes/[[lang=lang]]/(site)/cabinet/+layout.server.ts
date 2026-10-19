import { requireUser } from '#lib/server/auth/guard.ts';
import type { LayoutServerLoad } from './$types';

/* docs/06 section 3.2: every /cabinet page needs a signed-in user; pages check it again in actions. */
export const load: LayoutServerLoad = ({ locals }) => {
	requireUser(locals.user);
};
