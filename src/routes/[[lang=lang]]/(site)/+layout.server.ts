import { defaultLocale, isLocale } from '#lib/i18n/locales.ts';
import { isStaff } from '#lib/server/auth/permissions.ts';
import { db } from '#lib/server/db/index.ts';
import { getFooterSettings } from '#lib/server/services/site-settings.ts';
import type { LayoutServerLoad } from './$types';

/* Only the name and the staff flag reach the page: no email or contacts (docs/04 section 4).
 * params.lang (not locals) so the footer reloads when the language changes. */
export const load: LayoutServerLoad = async ({ locals, params }) => {
	const locale = isLocale(params.lang) ? params.lang : defaultLocale;
	const user = locals.user;
	return {
		viewer: user ? { name: user.name, isStaff: isStaff(user) } : null,
		footer: await getFooterSettings(db, locale)
	};
};
