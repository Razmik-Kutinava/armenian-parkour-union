import { defaultLocale, isLocale, localizePath } from '#lib/i18n/locales.ts';
import { translate } from '#lib/i18n/translate.ts';
import { buildSeo } from '#lib/seo/meta.ts';
import { cached } from '#lib/server/cache/index.ts';
import { db } from '#lib/server/db/index.ts';
import { membershipFee } from '#lib/server/services/memberships/fee.ts';
import { getMembershipOverview } from '#lib/server/services/memberships/overview.ts';
import { getPublishedPage } from '#lib/server/services/pages/public.ts';
import { pageSeo } from '#lib/server/services/pages/view.ts';
import { siteUrl } from '#lib/server/services/posts/view.ts';
import { getSeoBase } from '#lib/server/services/seo/base.ts';
import { payMembership } from '../pay-membership';
import type { Actions, PageServerLoad } from './$types';

export type JoinState = 'guest' | 'member' | 'payer';

/* docs/06 section 4.9; decisions.md 2026-10-19: the owner's text is the system page `join`
 * (shown once published), the fee block and the button work without it. */
export const load: PageServerLoad = async ({ locals, params, url }) => {
	const locale = isLocale(params.lang) ? params.lang : defaultLocale;
	const [page, fee, base] = await Promise.all([
		cached(['pages'], 'page', getPublishedPage, db, 'join', locale),
		cached(['settings'], 'membershipFee', membershipFee, db),
		cached(['settings'], 'seoBase', getSeoBase, db, locale, siteUrl(url))
	]);
	const user = locals.user;
	const state: JoinState = !user
		? 'guest'
		: (await getMembershipOverview(db, user.id)).active
			? 'member'
			: 'payer';
	const seo = page
		? pageSeo(page, base)
		: buildSeo({
				...base,
				path: localizePath('/join', locale),
				title: translate(locale, 'join.title')
			});
	return { page, fee, state, seo };
};

export const actions: Actions = { pay: payMembership };
