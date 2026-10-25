import { expect, test, type Page, type Response } from '@playwright/test';
import { hydrated } from './hydrated';

/* docs/06 § 8, docs/08 § 13: own files cached for a year, pictures sized and lazy below the
 * first screen, a page downloads only the dictionaries of its language. */

const HY_ONLY = 'Փակել';
const RU_ONLY = 'Закрыть';

/** Bodies of the JavaScript files the page loads until it is interactive. */
async function scriptsOf(page: Page, path: string): Promise<string> {
	const responses: Response[] = [];
	page.on('response', (res) => {
		if (res.request().resourceType() === 'script') responses.push(res);
	});
	await page.goto(path);
	await hydrated(page);
	await page.waitForLoadState('networkidle');
	return (await Promise.all(responses.map((res) => res.text()))).join('\n');
}

test('own fonts and pictures are served from hashed files cached for a year', async ({
	page,
	baseURL
}) => {
	const own: Response[] = [];
	page.on('response', (res) => {
		const kind = res.request().resourceType();
		if (new URL(res.url()).origin === new URL(baseURL!).origin && ['font', 'image'].includes(kind))
			own.push(res);
	});
	await page.goto('/');
	await hydrated(page);
	await page.waitForLoadState('networkidle');

	const files = own.filter((res) => new URL(res.url()).pathname !== '/brand/favicon.svg');
	expect(files.some((res) => res.request().resourceType() === 'font')).toBe(true);
	for (const res of files) {
		expect(new URL(res.url()).pathname, res.url()).toMatch(/^\/_app\/immutable\//);
		expect(res.headers()['cache-control'] ?? '', res.url()).toContain('immutable');
	}
});

test('every picture has its size, and pictures below the first screen load lazily', async ({
	page
}) => {
	await page.goto('/');
	await hydrated(page);
	const images = await page.locator('img').evaluateAll((list) =>
		list.map((img) => ({
			src: img.getAttribute('src'),
			sized: img.hasAttribute('width') && img.hasAttribute('height'),
			below: img.getBoundingClientRect().top >= window.innerHeight,
			loading: img.getAttribute('loading')
		}))
	);
	expect(images.length).toBeGreaterThan(0);
	for (const img of images) {
		expect(img.sized, `${img.src} has no width / height`).toBe(true);
		if (img.below) expect(img.loading, `${img.src} is below the first screen`).toBe('lazy');
	}
});

test('an English page does not download the Armenian and Russian texts', async ({ page }) => {
	const js = await scriptsOf(page, '/');
	expect(js.includes('Close'), 'English texts').toBe(true);
	expect(js.includes(HY_ONLY), 'Armenian texts').toBe(false);
	expect(js.includes(RU_ONLY), 'Russian texts').toBe(false);
});

test('an Armenian page downloads only Armenian and renders it after client navigation', async ({
	page
}) => {
	const js = await scriptsOf(page, '/hy');
	expect(js.includes(HY_ONLY), 'Armenian texts').toBe(true);
	expect(js.includes(RU_ONLY), 'Russian texts').toBe(false);

	await page.locator('header').getByRole('link', { name: 'Միջոցառումներ' }).first().click();
	await expect(page).toHaveURL(/\/hy\/events$/);
	await expect(page.getByRole('heading', { level: 1, name: 'Միջոցառումներ' })).toBeVisible();
});
