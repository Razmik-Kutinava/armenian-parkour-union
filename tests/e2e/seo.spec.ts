import { existsSync } from 'node:fs';
import { expect, test, type Page } from '@playwright/test';
import postgres from 'postgres';

if (!process.env.DATABASE_URL && existsSync('.env')) process.loadEnvFile('.env');
const sql = postgres(process.env.DATABASE_URL ?? '', { max: 1, onnotice: () => {} });
test.afterAll(() => sql.end());

const meta = (page: Page, key: string) =>
	page.locator(`meta[property="${key}"], meta[name="${key}"]`).first().getAttribute('content');
const alternates = (page: Page) =>
	page
		.locator('link[rel="alternate"][hreflang]')
		.evaluateAll((links) => links.map((l) => [l.getAttribute('hreflang'), l.getAttribute('href')]));

/* docs/06 section 7. */
test('robots.txt closes private sections and points to the sitemap', async ({ request }) => {
	const res = await request.get('/robots.txt');
	expect(res.status()).toBe(200);
	expect(res.headers()['content-type']).toContain('text/plain');
	const text = await res.text();
	for (const path of ['/admin', '/api', '/cabinet', '/certificate', '/ru/cabinet']) {
		expect(text).toContain(`Disallow: ${path}\n`);
	}
	expect(text).toMatch(/^Sitemap: https?:\/\/[^/]+\/sitemap\.xml$/m);
});

test('sitemap.xml lists a published page in every language, not a draft', async ({ request }) => {
	const published = `e2e-seo-${crypto.randomUUID().slice(0, 8)}`;
	const draft = `e2e-seo-${crypto.randomUUID().slice(0, 8)}`;
	await sql`insert into pages (slug, title, status) values
		(${published}, ${sql.json({ en: 'SEO page' })}, 'published'),
		(${draft}, ${sql.json({ en: 'SEO draft' })}, 'draft')`;
	try {
		const res = await request.get('/sitemap.xml');
		expect(res.status()).toBe(200);
		expect(res.headers()['content-type']).toContain('application/xml');
		const xml = await res.text();
		expect(xml).toContain('<urlset');
		for (const prefix of ['', '/hy', '/ru']) {
			expect(xml).toMatch(new RegExp(`<loc>https?://[^<]+${prefix}/pages/${published}</loc>`));
		}
		expect(xml).not.toContain(`/pages/${draft}`);
		expect(xml).toMatch(/<loc>https?:\/\/[^<]+\/events<\/loc>/);
	} finally {
		await sql`update pages set deleted_at = now() where slug in (${published}, ${draft})`;
	}
});

test('home: description, Open Graph, hreflang and Organization markup', async ({ page }) => {
	await page.goto('/ru');
	expect(await meta(page, 'description')).toBeTruthy();
	expect(await meta(page, 'og:title')).toBeTruthy();
	expect(await meta(page, 'og:locale')).toBe('ru_RU');
	expect(await page.locator('link[rel="canonical"]').getAttribute('href')).toMatch(/\/ru$/);
	const links = await alternates(page);
	expect(links.map((l) => l[0])).toEqual(['en', 'hy', 'ru', 'x-default']);
	expect(links[1][1]).toMatch(/\/hy$/);
	const ld = JSON.parse((await page.locator('script[type="application/ld+json"]').textContent())!);
	expect(ld).toMatchObject({ '@context': 'https://schema.org', '@type': 'Organization' });
});

test('a content page has its own title, description and canonical', async ({ page }) => {
	const slug = `e2e-seo-${crypto.randomUUID().slice(0, 8)}`;
	await sql`insert into pages (slug, title, body, status) values (${slug},
		${sql.json({ en: 'Training rules' })}, ${sql.json({ en: '<p>Warm up before every jump.</p>' })},
		'published')`;
	try {
		await page.goto(`/hy/pages/${slug}`);
		await expect(page).toHaveTitle(/^Training rules — /);
		expect(await meta(page, 'description')).toBe('Warm up before every jump.');
		expect(await meta(page, 'og:title')).toBe('Training rules');
		expect(await page.locator('link[rel="canonical"]').getAttribute('href')).toMatch(
			new RegExp(`/hy/pages/${slug}$`)
		);
		expect((await alternates(page)).map((l) => l[0])).toEqual(['en', 'hy', 'ru', 'x-default']);
	} finally {
		await sql`update pages set deleted_at = now() where slug = ${slug}`;
	}
});

test('sign-in pages are not indexed', async ({ page }) => {
	for (const path of ['/login', '/register', '/forgot-password']) {
		await page.goto(path);
		expect(await meta(page, 'robots'), path).toBe('noindex');
	}
	await page.goto('/events');
	expect(await page.locator('meta[name="robots"]').count()).toBe(0);
});
