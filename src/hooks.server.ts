import { redirect } from '@sveltejs/kit';
import type { Handle } from '@sveltejs/kit/hooks';
import { defaultLocaleRedirect, localeFromPath } from '#lib/i18n/locales.ts';

export const handle: Handle = async ({ event, resolve }) => {
	const canonical = defaultLocaleRedirect(event.url.pathname);
	if (canonical) redirect(308, canonical + event.url.search);

	const locale = localeFromPath(event.url.pathname);
	event.locals.locale = locale;

	return resolve(event, {
		transformPageChunk: ({ html }) => html.replace('%lang%', locale)
	});
};
