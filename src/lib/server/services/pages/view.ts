import { localizePath } from '#lib/i18n/locales.ts';
import { pagePath } from '#lib/page-path.ts';
import { buildSeo, textFromHtml, type Seo } from '#lib/seo/meta.ts';
import type { SeoBase } from '../seo/base';
import type { PublicPage } from './public';

/* docs/06 section 7: a content page; "About" lives at /federation, "Join" at /join. */
export function pageSeo(page: PublicPage, base: SeoBase): Seo {
	return buildSeo({
		...base,
		path: localizePath(pagePath(page.slug), base.locale),
		title: page.title,
		description: textFromHtml(page.html) || base.description
	});
}
