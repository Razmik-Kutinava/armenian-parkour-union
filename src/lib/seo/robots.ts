import { localizePath, locales } from '#lib/i18n/locales.ts';

/* docs/06 section 7.2. Sign-in pages stay crawlable: they carry noindex, which a closed page hides. */

const UNPREFIXED = ['/admin', '/api'];
const PER_LANGUAGE = ['/cabinet', '/certificate'];

export function renderRobots(siteUrl: string): string {
	const closed = [
		...UNPREFIXED,
		...locales.flatMap((locale) => PER_LANGUAGE.map((path) => localizePath(path, locale)))
	];
	return [
		'User-agent: *',
		...closed.map((path) => `Disallow: ${path}`),
		'',
		`Sitemap: ${siteUrl.replace(/\/+$/, '')}/sitemap.xml`,
		''
	].join('\n');
}
