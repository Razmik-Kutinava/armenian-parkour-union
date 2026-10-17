import { defaultLocale, isLocale, localizePath } from '#lib/i18n/locales.ts';
import { translate, type MessageKey } from '#lib/i18n/translate.ts';
import { db } from '#lib/server/db/index.ts';
import { siteUrl } from '#lib/server/services/posts/view.ts';
import { getSeoBase } from '#lib/server/services/seo/base.ts';
import { buildSeo } from '#lib/seo/meta.ts';
import type { PageServerLoad } from './$types';

/* docs/06 section 7.3. While the festival announcement leads the page, link previews show it. */
export const load: PageServerLoad = async ({ params, parent, url }) => {
	const locale = isLocale(params.lang) ? params.lang : defaultLocale;
	const [{ footer }, base] = await Promise.all([parent(), getSeoBase(db, locale, siteUrl(url))]);
	const fest = (key: MessageKey) => translate(locale, key);
	return {
		seo: buildSeo({
			...base,
			path: localizePath('/', locale),
			title: fest('fest.title'),
			description: `${fest('fest.subtitle')} · ${fest('fest.dates')}`,
			image: {
				url: `${base.siteUrl.replace(/\/+$/, '')}/fest/yerevan-parkour-fest-2027.jpg`,
				alt: fest('fest.imageAlt')
			},
			organization: {
				sameAs: footer.socials.map((s) => s.url),
				email: footer.contacts?.email,
				phone: footer.contacts?.phone,
				description: base.description
			}
		})
	};
};
