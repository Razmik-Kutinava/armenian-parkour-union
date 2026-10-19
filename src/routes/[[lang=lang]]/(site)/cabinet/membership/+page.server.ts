import { requireUser } from '#lib/server/auth/guard.ts';
import { cached } from '#lib/server/cache/index.ts';
import { db } from '#lib/server/db/index.ts';
import { membershipFee } from '#lib/server/services/memberships/fee.ts';
import { getMembershipOverview } from '#lib/server/services/memberships/overview.ts';
import { payMembership } from '../../pay-membership';
import type { Actions, PageServerLoad } from './$types';

/* docs/06 section 5.3: status, period, history, pay or renew; the user id comes from the session. */
export const load: PageServerLoad = async ({ locals }) => {
	const user = requireUser(locals.user);
	const [overview, fee] = await Promise.all([
		getMembershipOverview(db, user.id),
		cached(['settings'], 'membershipFee', membershipFee, db)
	]);
	return { overview, fee };
};

export const actions: Actions = { pay: payMembership };
