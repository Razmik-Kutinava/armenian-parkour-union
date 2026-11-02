import { fail, redirect } from '@sveltejs/kit';
import { localizePath } from '#lib/i18n/locales.ts';
import { db } from '#lib/server/db/index.ts';
import {
	bindCashier,
	CASHIER_COOKIE,
	CASHIER_COOKIE_MAX_AGE,
	findInvite
} from '#lib/server/services/volunteer/cashier-access.ts';
import type { Actions, PageServerLoad } from './$types';

/* docs/06 section 4.13, docs/03 section 19.4 item 1. Opening only shows the link: binding is the
 * button, so a messenger's link preview cannot use the one-time link up. One page for every
 * failure — used, expired, disabled or unknown. */
export const load: PageServerLoad = async ({ params, setHeaders }) => {
	setHeaders({ 'cache-control': 'no-store', 'x-robots-tag': 'noindex' });
	return { invite: await findInvite(db, params.token) };
};

export const actions: Actions = {
	default: async ({ params, cookies, locals }) => {
		const device = await bindCashier(db, params.token);
		if (!device) return fail(400, { invalid: true as const });
		cookies.set(CASHIER_COOKIE, device, {
			path: '/',
			httpOnly: true,
			sameSite: 'lax',
			maxAge: CASHIER_COOKIE_MAX_AGE
		});
		redirect(303, localizePath('/partner', locals.locale));
	}
};
