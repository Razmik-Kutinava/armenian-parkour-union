import { alternateLinks } from './alternates';

/* docs/06 section 7.2: sitemaps.org format, each address in every language with hreflang links. */

/** `path` is the English (unprefixed) address. */
export type SitemapEntry = { path: string; lastmod?: Date };

const escapeXml = (text: string) =>
	text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

export function renderSitemap(siteUrl: string, entries: SitemapEntry[]): string {
	const urls = entries.flatMap(({ path, lastmod }) => {
		const links = alternateLinks(siteUrl, path);
		const xhtml = links
			.map(
				(l) => `<xhtml:link rel="alternate" hreflang="${l.hreflang}" href="${escapeXml(l.href)}"/>`
			)
			.join('');
		const date = lastmod ? `<lastmod>${lastmod.toISOString()}</lastmod>` : '';
		return links
			.filter((l) => l.hreflang !== 'x-default')
			.map((l) => `<url><loc>${escapeXml(l.href)}</loc>${date}${xhtml}</url>`);
	});
	return [
		'<?xml version="1.0" encoding="UTF-8"?>',
		'<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">',
		...urls,
		'</urlset>',
		''
	].join('\n');
}
