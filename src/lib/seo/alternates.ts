import { defaultLocale, localizePath, locales, type Locale } from '#lib/i18n/locales.ts';

/* docs/06 section 7.4: every enabled language version of a page, and x-default for the rest. */

export type Alternate = { hreflang: string; href: string };

/** `path` may carry a language prefix and a query; the query is kept in every language. */
export function alternateLinks(
	siteUrl: string,
	path: string,
	enabled: readonly Locale[] = locales
): Alternate[] {
	const origin = siteUrl.replace(/\/+$/, '');
	const [pathname, query] = path.split(/\?(.*)/s, 2);
	const href = (locale: Locale) =>
		`${origin}${localizePath(pathname, locale)}${query ? `?${query}` : ''}`;
	return [
		...enabled.map((locale) => ({ hreflang: locale, href: href(locale) })),
		{ hreflang: 'x-default', href: href(defaultLocale) }
	];
}
