import { describe, expect, it } from 'vitest';
import { renderSitemap } from './sitemap';

describe('seo: sitemap.xml (docs/06 section 7.2)', () => {
	const xml = renderSitemap('https://parkour.am/', [
		{ path: '/' },
		{ path: '/news/jam', lastmod: new Date('2026-10-08T08:30:00Z') }
	]);
	const urls = [...xml.matchAll(/<url>([\s\S]*?)<\/url>/g)].map((m) => m[1]);

	it('a sitemaps.org urlset with the hreflang namespace', () => {
		expect(xml.startsWith('<?xml version="1.0" encoding="UTF-8"?>\n')).toBe(true);
		expect(xml).toContain('xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"');
		expect(xml).toContain('xmlns:xhtml="http://www.w3.org/1999/xhtml"');
	});

	it('every address in three languages, each listing all languages and x-default', () => {
		const locs = urls.map((u) => u.match(/<loc>(.*?)<\/loc>/)![1]);
		expect(locs).toEqual([
			'https://parkour.am/',
			'https://parkour.am/hy',
			'https://parkour.am/ru',
			'https://parkour.am/news/jam',
			'https://parkour.am/hy/news/jam',
			'https://parkour.am/ru/news/jam'
		]);
		const links = [
			...urls[4].matchAll(/<xhtml:link rel="alternate" hreflang="([^"]+)" href="([^"]+)"\/>/g)
		];
		expect(links.map((l) => [l[1], l[2]])).toEqual([
			['en', 'https://parkour.am/news/jam'],
			['hy', 'https://parkour.am/hy/news/jam'],
			['ru', 'https://parkour.am/ru/news/jam'],
			['x-default', 'https://parkour.am/news/jam']
		]);
	});

	it('lastmod only where the date is known', () => {
		expect(urls[0]).not.toContain('<lastmod>');
		expect(urls[3]).toContain('<lastmod>2026-10-08T08:30:00.000Z</lastmod>');
	});

	it('addresses are escaped for XML', () => {
		const out = renderSitemap('https://parkour.am', [{ path: '/events?city=A&period=week' }]);
		expect(out).toContain('<loc>https://parkour.am/events?city=A&amp;period=week</loc>');
		expect(out).not.toMatch(/&(?!amp;)/);
	});
});
