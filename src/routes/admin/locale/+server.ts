import { error, redirect } from '@sveltejs/kit';
import { isLocale } from '#lib/i18n/locales.ts';
import { requireStaff } from '#lib/server/auth/guard.ts';
import { safeReturnTo } from '#lib/server/auth/return-to.ts';
import { db } from '#lib/server/db/index.ts';
import { setLocale } from '#lib/server/services/profile.ts';
import type { RequestHandler } from './$types';

const insideAdmin = (path: string) => /^\/admin(?:[/?#]|$)/.test(path);

/** Language switcher of the admin user menu: own profile only, back to the same admin page. */
export const POST: RequestHandler = async ({ request, locals }) => {
	const user = requireStaff(locals.user);
	const form = await request.formData();
	const locale = form.get('locale');
	if (!isLocale(locale)) error(400, 'Bad locale');

	await setLocale(db, user.id, locale);
	const back = safeReturnTo(String(form.get('returnTo') ?? ''), '/admin');
	redirect(303, insideAdmin(back) ? back : '/admin');
};
