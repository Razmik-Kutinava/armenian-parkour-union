import { redirect } from '@sveltejs/kit';
import type { Handle } from '@sveltejs/kit/hooks';
import { getSessionCookie } from 'better-auth/cookies';
import { defaultLocaleRedirect, localeFromPath } from '#lib/i18n/locales.ts';
import { auth } from '#lib/server/auth/index.ts';
import { canonicalHostRedirect } from '#lib/server/auth/canonical-host.ts';
import { toLocalsUser } from '#lib/server/auth/session.ts';

const isAdminPath = (pathname: string) => pathname === '/admin' || pathname.startsWith('/admin/');

export const handle: Handle = async ({ event, resolve }) => {
	const host = canonicalHostRedirect(event.url);
	if (host) redirect(301, host);

	const canonical = defaultLocaleRedirect(event.url.pathname);
	if (canonical) redirect(308, canonical + event.url.search);

	/* No session cookie — a guest without a database query. Otherwise the session and user status are
	 * read on every request, so blocking takes effect at once (docs/04 sections 5.2, 8). */
	event.locals.user = null;
	if (getSessionCookie(event.request.headers)) {
		const session = await auth().api.getSession({ headers: event.request.headers });
		event.locals.user = toLocalsUser(session?.user);
	}

	/* /admin has no language prefix: staff see it in their profile language (decisions, 1.9). */
	const user = event.locals.user;
	const locale =
		isAdminPath(event.url.pathname) && user ? user.locale : localeFromPath(event.url.pathname);
	event.locals.locale = locale;

	return resolve(event, {
		transformPageChunk: ({ html }) => html.replace('%lang%', locale)
	});
};
