import { expect, test } from '@playwright/test';

test('English is the default without prefix', async ({ page }) => {
	await page.goto('/');
	await expect(page.locator('html')).toHaveAttribute('lang', 'en');
	await expect(page.getByText('Site under construction.')).toBeVisible();
});

test('Armenian and Russian are served under /hy and /ru', async ({ page }) => {
	await page.goto('/hy');
	await expect(page.locator('html')).toHaveAttribute('lang', 'hy');
	await expect(page.getByText('Կայքը մշակման փուլում է։')).toBeVisible();

	await page.goto('/ru');
	await expect(page.locator('html')).toHaveAttribute('lang', 'ru');
	await expect(page.getByText('Сайт в разработке.')).toBeVisible();
});

test('missing translation falls back to English', async ({ page }) => {
	await page.goto('/hy');
	await expect(page.getByRole('heading', { level: 1 })).toHaveText('Armenian Parkour Union');
});

test('/en duplicates redirect to the unprefixed page', async ({ request }) => {
	const response = await request.get('/en?x=1', { maxRedirects: 0 });
	expect(response.status()).toBe(308);
	expect(response.headers().location).toBe('/?x=1');
});

test('unknown language prefix is not a page', async ({ request }) => {
	expect((await request.get('/de')).status()).toBe(404);
});
