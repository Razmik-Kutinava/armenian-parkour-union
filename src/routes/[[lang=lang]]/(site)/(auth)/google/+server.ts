import { error, redirect } from '@sveltejs/kit';
import { localizePath } from '#lib/i18n/locales.ts';
import { googleEnabled, startGoogle } from '#lib/server/auth/google.ts';
import { safeReturnTo } from '#lib/server/auth/return-to.ts';
import type { RequestHandler } from './$types';

/** The "Continue with Google" button on /login and /register posts here (a plain form, no JS). */
export const POST: RequestHandler = async (event) => {
	if (!googleEnabled()) error(404);
	const { locale } = event.locals;
	const home = localizePath('/', locale);
	if (event.locals.user) redirect(303, home);

	const form = await event.request.formData();
	const returnTo = safeReturnTo(String(form.get('returnTo') ?? ''), home);
	const url = await startGoogle(returnTo, locale, event.getClientAddress(), event.request.headers);
	if (!url) redirect(303, `${localizePath('/login', locale)}?error=limited`);
	/* Kit's redirect() refuses other origins; the URL comes from Better Auth, not from the form. */
	return new Response(null, { status: 303, headers: { location: url } });
};
