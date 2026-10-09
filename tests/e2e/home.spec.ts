import { expect, test } from '@playwright/test';

test('home page announces the festival as planned', async ({ page }) => {
	await page.goto('/');
	await expect(page.getByRole('heading', { level: 1 })).toHaveText('Yerevan Parkour Fest 2027');
	await expect(page.getByText('Yerevan · 14–17 June 2027')).toBeVisible();
	await expect(page.getByText('Planned dates')).toBeVisible();
});

test('festival announcement is translated', async ({ page }) => {
	await page.goto('/hy');
	await expect(page.getByText('Երևան · 2027 թ. հունիսի 14–17')).toBeVisible();
	await page.goto('/ru');
	await expect(page.getByText('Ереван · 14–17 июня 2027')).toBeVisible();
});
