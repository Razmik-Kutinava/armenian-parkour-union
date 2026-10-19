import { defaultLocale, isLocale, localizePath } from '#lib/i18n/locales.ts';
import { translate } from '#lib/i18n/translate.ts';
import { buildSeo } from '#lib/seo/meta.ts';
import { cached } from '#lib/server/cache/index.ts';
import { db } from '#lib/server/db/index.ts';
import { recentDonations } from '#lib/server/services/donations/public.ts';
import { listActivePurposes } from '#lib/server/services/donations/purposes.ts';
import { donationSettings } from '#lib/server/services/donations/settings.ts';
import { siteUrl } from '#lib/server/services/posts/view.ts';
import { getSeoBase } from '#lib/server/services/seo/base.ts';
import { donate } from './donate';
import type { Actions, PageServerLoad } from './$types';

/* docs/06 section 4.8: open to everyone; a member donates as the account, a guest gives contacts. */
export const load: PageServerLoad = async ({ locals, params, url }) => {
	const locale = isLocale(params.lang) ? params.lang : defaultLocale;
	const [settings, purposes, base] = await Promise.all([
		cached(['settings'], 'donationSettings', donationSettings, db),
		cached(['settings'], 'donationPurposes', listActivePurposes, db, locale),
		cached(['settings'], 'seoBase', getSeoBase, db, locale, siteUrl(url))
	]);
	const recent = settings.publicList
		? await cached(['settings'], 'recentDonations', recentDonations, db)
		: [];
	const user = locals.user;
	return {
		limits: settings.limits,
		purposes,
		recent,
		donor: user ? { name: user.name, email: user.email } : null,
		seo: buildSeo({
			...base,
			path: localizePath('/donate', locale),
			title: translate(locale, 'donate.title'),
			description: translate(locale, 'donate.intro')
		})
	};
};

export const actions: Actions = { donate };
