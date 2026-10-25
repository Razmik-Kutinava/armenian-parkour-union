import { expect, test, type Page } from '@playwright/test';
import { hydrated } from './hydrated';

/** Chrome reports every blocked resource or script to the console. */
const violations = (page: Page) => {
	const found: string[] = [];
	page.on('console', (msg) => {
		if (msg.text().includes('Content Security Policy')) found.push(msg.text());
	});
	return found;
};

test('pages carry a nonce-based CSP that forbids framing', async ({ request }) => {
	const res = await request.get('/');
	const header = res.headers()['content-security-policy'] ?? '';
	expect(header).toMatch(/script-src 'self' 'nonce-[\w+/=]+'/);
	expect(header).toContain("frame-ancestors 'none'");
	expect(header).toContain("object-src 'none'");
	expect(header).toContain(
		"form-action 'self' https://accounts.google.com https://checkout.vpos.am"
	);
});

test('pages and redirects carry security headers', async ({ request }) => {
	for (const path of ['/', '/login', '/admin']) {
		const headers = (await request.get(path, { maxRedirects: 0 })).headers();
		expect(headers['x-content-type-options'], path).toBe('nosniff');
		expect(headers['x-frame-options'], path).toBe('DENY');
		expect(headers['strict-transport-security'], path).toBe('max-age=31536000');
		expect(headers['referrer-policy'], path).toBe('strict-origin-when-cross-origin');
		expect(headers['permissions-policy'], path).toContain('camera=()');
	}
});

test('public pages hydrate and play video without CSP violations', async ({ page }) => {
	const found = violations(page);
	for (const path of ['/', '/events', '/news', '/login', '/hy', '/ru/donate']) {
		await page.goto(path);
		await hydrated(page);
	}
	await page.goto('/');
	await hydrated(page);
	const video = page
		.locator('section')
		.filter({ has: page.getByRole('heading', { name: 'What is parkour' }) })
		.last();
	await video.getByRole('button', { name: 'Play video' }).click();
	await expect(video.locator('iframe')).toBeVisible();
	expect(found).toEqual([]);
});
