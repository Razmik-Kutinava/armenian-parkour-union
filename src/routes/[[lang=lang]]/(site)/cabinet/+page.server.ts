import { error, fail } from '@sveltejs/kit';
import { resendVerification } from '#lib/server/auth/account.ts';
import { accountCalls } from '#lib/server/auth/account-calls.ts';
import { requireUser } from '#lib/server/auth/guard.ts';
import { db } from '#lib/server/db/index.ts';
import { getCabinetOverview } from '#lib/server/services/cabinet/overview.ts';
import { publicUrl } from '#lib/server/storage/r2.ts';
import type { Actions, PageServerLoad } from './$types';

/* docs/06 section 5.1: the user id comes from the session (docs/04 section 5.3). */
export const load: PageServerLoad = async ({ locals }) => {
	const user = requireUser(locals.user);
	const overview = await getCabinetOverview(db, user.id);
	if (!overview) error(404);
	return { overview, avatarUrl: overview.avatarKey ? publicUrl(overview.avatarKey) : null };
};

export const actions: Actions = {
	/** docs/06 section 2: the confirmation letter again; the banner links here. */
	resendVerification: async ({ locals, request }) => {
		const user = requireUser(locals.user);
		const result = await resendVerification(db, user, accountCalls(request.headers, user.email));
		if (result === 'limited') return fail(429, { verify: 'cabinet.verify.limited' as const });
		return {
			verify:
				result === 'ok' ? ('cabinet.verify.sent' as const) : ('cabinet.verify.already' as const)
		};
	}
};
