import { expect, type Page } from '@playwright/test';
import type postgres from 'postgres';

/* Seed values of the payment keys: the CI database starts empty, so a blank field gets one. */
export const PAYMENT_FORM_DEFAULTS = {
	feeAmount: '0',
	feePeriodMonths: '12',
	donationMin: '1000',
	donationMax: '1000000',
	waitMinutes: '30'
};

/** A fresh account made admin with SQL; returns its id. */
export async function registerAdmin(page: Page, sql: postgres.Sql, lastName: string) {
	const email = `e2e-pay-settings-${crypto.randomUUID()}@example.com`;
	await page.goto('/register');
	await page.getByLabel('Email').fill(email);
	await page.getByLabel('Password').fill('parkour-pass-1');
	await page.getByLabel('First name').fill('Settings');
	await page.getByLabel('Last name').fill(lastName);
	await page.getByLabel('Date of birth').fill('1990-01-01');
	await page.getByLabel(/privacy policy/).check();
	await page.getByRole('button', { name: 'Create account' }).click();
	await expect(page).toHaveURL('/');
	const [row] = await sql`update users set role = 'admin' where email = ${email} returning id`;
	return row.id as string;
}

/** Opens the payment settings with every blank field filled, so saving one change is valid. */
export async function openPaymentSettings(page: Page) {
	await page.goto('/admin/settings/payments');
	for (const [name, value] of Object.entries(PAYMENT_FORM_DEFAULTS)) {
		const input = page.locator(`input[name="${name}"]`);
		if (!(await input.inputValue())) await input.fill(value);
	}
}

/**
 * For admin-audit.spec.ts: the stored form as rendered, only the wait changed, so the fee and
 * limits that membership.spec.ts and donate.spec.ts set meanwhile stay as they are.
 */
export const paymentSettingsAction = (
	page: Page,
	post: (path: string, form: Record<string, string>) => Promise<void>
) => ({
	'/admin/settings/payments?/default': async () => {
		await page.goto('/admin/settings/payments');
		const field = page.locator('input[name="waitMinutes"]');
		const form = await field.evaluate((el: HTMLInputElement) =>
			Object.fromEntries([...new FormData(el.form!)].map(([k, v]) => [k, String(v)]))
		);
		for (const [name, value] of Object.entries(PAYMENT_FORM_DEFAULTS)) form[name] ||= value;
		/* Always a change: an unchanged key writes no entry. */
		const wait = form.waitMinutes === '777' ? '778' : '777';
		await post('/admin/settings/payments', { ...form, waitMinutes: wait });
	}
});
