import { redirect } from '@sveltejs/kit';
import { localizePath } from '#lib/i18n/locales.ts';

/** Login, registration and password request are for guests (docs/06 section 3.1). */
export function redirectIfSignedIn(locals: App.Locals): void {
	if (locals.user) redirect(303, localizePath('/', locals.locale));
}
