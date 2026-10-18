import { defaultLocale, isLocale, localizePath } from '#lib/i18n/locales.ts';
import { translate, type MessageKey } from '#lib/i18n/translate.ts';
import { cached } from '#lib/server/cache/index.ts';
import { db } from '#lib/server/db/index.ts';
import { withEventCover } from '#lib/server/services/events/view.ts';
import { getHeroSlides } from '#lib/server/services/hero/public.ts';
import { withHeroMedia } from '#lib/server/services/hero/view.ts';
import { getHomeSections } from '#lib/server/services/home.ts';
import { siteUrl, withCover } from '#lib/server/services/posts/view.ts';
import { getSeoBase } from '#lib/server/services/seo/base.ts';
import { buildSeo } from '#lib/seo/meta.ts';
import type { PageServerLoad } from './$types';

/*
 * docs/06 section 4.1; the festival announcement stays right under the hero (decisions.md
 * 2026-10-17). SEO — section 7.3: while the announcement is on the page, link previews show it.
 */
export const load: PageServerLoad = async ({ params, parent, url }) => {
	const locale = isLocale(params.lang) ? params.lang : defaultLocale;
	const [{ footer }, base, slides, sections] = await Promise.all([
		parent(),
		cached(['settings'], 'seoBase', getSeoBase, db, locale, siteUrl(url)),
		cached(['hero', 'events'], 'heroSlides', getHeroSlides, db, locale),
		cached(['events', 'posts', 'pages'], 'homeSections', getHomeSections, db, locale)
	]);
	const fest = (key: MessageKey) => translate(locale, key);
	return {
		slides: slides.map(withHeroMedia),
		events: sections.events.map(withEventCover),
		about: sections.about,
		news: sections.news.map(withCover),
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
