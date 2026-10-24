import { defaultLocale, isLocale, localizePath } from '#lib/i18n/locales.ts';
import { translate } from '#lib/i18n/translate.ts';
import { cached } from '#lib/server/cache/index.ts';
import { db } from '#lib/server/db/index.ts';
import { siteUrl } from '#lib/server/services/posts/view.ts';
import { getSeoBase } from '#lib/server/services/seo/base.ts';
import { listPublicStaff, type StaffCard } from '#lib/server/services/staff/public.ts';
import { publicUrl } from '#lib/server/storage/r2.ts';
import { buildSeo } from '#lib/seo/meta.ts';
import type { PageServerLoad } from './$types';

/* docs/06 section 4.6: two sections, coaches and judges. */
export const load: PageServerLoad = async ({ params, url }) => {
	const locale = isLocale(params.lang) ? params.lang : defaultLocale;
	const [team, base] = await Promise.all([
		cached(['staff'], 'staff', listPublicStaff, db, locale),
		cached(['settings'], 'seoBase', getSeoBase, db, locale, siteUrl(url))
	]);
	const card = ({ avatarKey, ...rest }: StaffCard) => ({
		...rest,
		photoUrl: avatarKey ? publicUrl(avatarKey) : null
	});
	return {
		trainers: team.trainers.map(card),
		judges: team.judges.map(card),
		seo: buildSeo({
			...base,
			path: localizePath('/federation/team', locale),
			title: translate(locale, 'team.title'),
			description: translate(locale, 'team.description')
		})
	};
};
