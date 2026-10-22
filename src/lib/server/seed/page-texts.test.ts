import { describe, expect, it } from 'vitest';
import { SYSTEM_PAGE_SLUGS, pageFormSchema } from '#lib/validation/pages.ts';
import { PAGE_TEXTS } from './page-texts';
import { SEED_PAGES } from './pages';

const parse = (slug: string) =>
	pageFormSchema('https://media.parkour.am').parse({
		slug,
		title: SEED_PAGES[slug],
		body: PAGE_TEXTS[slug],
		status: 'published'
	});

describe('system page texts', () => {
	it('one entry per system page, in all three languages', () => {
		expect(Object.keys(PAGE_TEXTS).sort()).toEqual([...SYSTEM_PAGE_SLUGS].sort());
		for (const [slug, body] of Object.entries(PAGE_TEXTS)) {
			expect(Object.keys(body).sort(), slug).toEqual(['en', 'hy', 'ru']);
		}
	});

	it('survive the admin form cleaning unchanged', () => {
		for (const slug of SYSTEM_PAGE_SLUGS) expect(parse(slug).body, slug).toEqual(PAGE_TEXTS[slug]);
	});

	it('no unfilled [placeholders]', () => {
		for (const [slug, body] of Object.entries(PAGE_TEXTS)) {
			for (const html of Object.values(body)) expect(html, slug).not.toMatch(/\[[^\]]*\]/);
		}
	});

	it('site links lead to a page in the same language', () => {
		for (const [slug, body] of Object.entries(PAGE_TEXTS)) {
			for (const [lang, html] of Object.entries(body)) {
				const prefix = lang === 'en' ? '/pages/' : `/${lang}/pages/`;
				for (const [, href] of html.matchAll(/href="(\/[^"]*)"/g)) {
					expect(href.startsWith(prefix), `${slug}.${lang}: ${href}`).toBe(true);
					expect(SYSTEM_PAGE_SLUGS, href).toContain(href.slice(prefix.length));
				}
			}
		}
	});
});
