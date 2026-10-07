/** Languages: English by default without prefix, /hy and /ru (06-PUBLIC-SITE, section 1). */
export const locales = ['en', 'hy', 'ru'] as const;
export type Locale = (typeof locales)[number];
export const defaultLocale: Locale = 'en';
/** Each language names itself in the switcher, whatever the page language. */
export const localeNames: Record<Locale, string> = { en: 'English', hy: 'Հայերեն', ru: 'Русский' };

export function isLocale(value: unknown): value is Locale {
	return typeof value === 'string' && (locales as readonly string[]).includes(value);
}

/** Locale from the first path segment; anything else is the default locale. */
export function localeFromPath(pathname: string): Locale {
	const segment = pathname.split('/')[1];
	return isLocale(segment) && segment !== defaultLocale ? segment : defaultLocale;
}

function stripLocale(pathname: string): string {
	const locale = localeFromPath(pathname);
	if (locale === defaultLocale) return pathname || '/';
	return pathname.slice(locale.length + 1) || '/';
}

/** Same page in another language: localizePath('/hy/events', 'ru') === '/ru/events'. */
export function localizePath(pathname: string, locale: Locale): string {
	/* '//host' or '/\host' in an href leaves the site: keep exactly one leading slash. */
	const bare = '/' + stripLocale(pathname).replace(/^[/\\]+/, '');
	if (locale === defaultLocale) return bare;
	return bare === '/' ? `/${locale}` : `/${locale}${bare}`;
}

/** '/en/...' duplicates the unprefixed English page: returns the canonical path, or null. */
export function defaultLocaleRedirect(pathname: string): string | null {
	const prefix = `/${defaultLocale}`;
	if (pathname === prefix) return '/';
	if (pathname.startsWith(`${prefix}/`)) return pathname.slice(prefix.length);
	return null;
}
