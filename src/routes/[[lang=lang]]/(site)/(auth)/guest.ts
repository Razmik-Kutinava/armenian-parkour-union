import { redirect } from '@sveltejs/kit';
import { localizePath, type Locale } from '#lib/i18n/locales.ts';

/** Where a signed-in user lands when there is no return address (docs/06 section 4.11). */
export const cabinetPath = (locale: Locale) => localizePath('/cabinet', locale);

/** Login, registration and password request are for guests (docs/06 section 3.1). */
export function redirectIfSignedIn(locals: App.Locals): void {
	if (locals.user) redirect(303, cabinetPath(locals.locale));
}
