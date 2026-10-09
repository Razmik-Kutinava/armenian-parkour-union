import { expect, test } from '@playwright/test';

test('home page announces the festival as planned', async ({ page }) => {
	await page.goto('/');
	await expect(page.getByRole('heading', { level: 1 })).toHaveText('Yerevan Parkour Fest 2027');
	await expect(page.getByText('Yerevan · 14–17 June 2027')).toBeVisible();
	await expect(page.getByText('Planned dates')).toBeVisible();
	await expect(page.getByAltText('Yerevan Parkour Fest 2027 poster')).toHaveAttribute(
		'src',
		/poster-en\.png$/
	);
	await expect(page.getByRole('link', { name: 'info@parkour.am' })).toBeVisible();
});

test('parkour video loads the player only on click', async ({ page }) => {
	await page.goto('/');
	await expect(page.getByRole('heading', { name: 'What is parkour' })).toBeVisible();
	await expect(page.locator('iframe')).toHaveCount(0);
	await page.getByRole('button', { name: 'Play video' }).click();
	await expect(page.locator('iframe')).toHaveAttribute(
		'src',
		/^https:\/\/www\.youtube-nocookie\.com\/embed\/kMpYHcuipuY/
	);
	await page.goto('/ru');
	await expect(page.getByRole('heading', { name: 'Что такое паркур' })).toBeVisible();
});

test('festival announcement is translated', async ({ page }) => {
	await page.goto('/hy');
	await expect(page.getByText('Երևան · 2027 թ. հունիսի 14–17')).toBeVisible();
	await expect(page.locator('img[src$="poster-hy.png"]')).toBeVisible();
	await page.goto('/ru');
	await expect(page.getByText('Ереван · 14–17 июня 2027')).toBeVisible();
	await expect(page.locator('img[src$="poster.png"]')).toBeVisible();
});
