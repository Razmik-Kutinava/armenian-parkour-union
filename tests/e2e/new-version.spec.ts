import { expect, test } from '@playwright/test';

test('a tab opened before a deploy loads the next page in full', async ({ page }) => {
	await page.goto('/');
	await expect(page.locator('html[data-hydrated]')).toHaveCount(1);
	await page.evaluate(() => Object.assign(window, { oldTab: true }));

	await page.route('**/_app/version.json', (route) => route.fulfill({ json: { version: 'next' } }));
	const checked = page.waitForRequest('**/_app/version.json');
	await page.evaluate(() => window.dispatchEvent(new Event('focus')));
	await checked;

	await page.getByRole('banner').getByRole('link', { name: 'News', exact: true }).click();
	await expect(page).toHaveURL('/news');
	await expect(page.locator('html[data-hydrated]')).toHaveCount(1);
	expect(await page.evaluate(() => 'oldTab' in window)).toBe(false);
});

test('without a new version the next page loads in the same tab', async ({ page }) => {
	await page.goto('/');
	await expect(page.locator('html[data-hydrated]')).toHaveCount(1);
	await page.evaluate(() => Object.assign(window, { oldTab: true }));

	await page.getByRole('banner').getByRole('link', { name: 'News', exact: true }).click();
	await expect(page).toHaveURL('/news');
	expect(await page.evaluate(() => 'oldTab' in window)).toBe(true);
});
