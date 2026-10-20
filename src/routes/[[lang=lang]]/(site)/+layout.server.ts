import { defaultLocale, isLocale } from '#lib/i18n/locales.ts';
import { isStaff } from '#lib/server/auth/permissions.ts';
import { cached } from '#lib/server/cache/index.ts';
import { db } from '#lib/server/db/index.ts';
import { loadMembershipReminder } from '#lib/server/services/cabinet/reminder.ts';
import { getFooterSettings } from '#lib/server/services/site-settings.ts';
import type { LayoutServerLoad } from './$types';

/* Only the name, the staff flag and the banner flags reach the page: no email or contacts
 * (docs/04 section 4). params.lang (not locals) so the footer reloads when the language changes. */
export const load: LayoutServerLoad = async ({ locals, params }) => {
	const locale = isLocale(params.lang) ? params.lang : defaultLocale;
	const user = locals.user;
	const [footer, reminder] = await Promise.all([
		cached(['settings'], 'footer', getFooterSettings, db, locale),
		user ? loadMembershipReminder(db, user.id) : null
	]);
	return {
		viewer: user
			? { name: user.name, isStaff: isStaff(user), emailVerified: user.emailVerified, reminder }
			: null,
		footer
	};
};
