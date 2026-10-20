import { existsSync } from 'node:fs';
import { expect, test } from '@playwright/test';
import postgres from 'postgres';
import { openPaymentSettings, registerAdmin } from './payment-settings-form';

/* docs/05 section 21 "Membership", docs/04 (settings.write — admin only); decisions.md 2026-10-19
 * (3.6, 3.7). The fee and donation limits shown on /join and /donate are checked in
 * membership.spec.ts and donate.spec.ts: those files own the keys while they run. */

if (!process.env.DATABASE_URL && existsSync('.env')) process.loadEnvFile('.env');
const sql = postgres(process.env.DATABASE_URL ?? '', { max: 1, onnotice: () => {} });
const ORIGIN = { origin: 'http://localhost:4173' };
let savedWait: unknown = undefined;

test.describe.configure({ mode: 'serial' });

test.beforeAll(async () => {
	const [row] = await sql`select value from site_settings where key = 'payment_wait_minutes'`;
	savedWait = row?.value;
});

test.afterAll(async () => {
	if (savedWait === undefined) {
		await sql`delete from site_settings where key = 'payment_wait_minutes'`;
	} else {
		await sql`update site_settings set value = ${sql.json(savedWait as never)}
			where key = 'payment_wait_minutes'`;
	}
	await sql.end();
});

test.beforeEach(async () => {
	await sql`delete from rate_limit where key ~ '^sign-up:ip:(127\.0\.0\.1|::1|::ffff:127\.0\.0\.1)$'`;
});

for (const role of ['editor', 'moderator'] as const) {
	test(`${role}: 403 on the page and on a direct POST, nothing saved`, async ({ page }) => {
		const id = await registerAdmin(page, sql, role);
		await sql`update users set role = ${role} where id = ${id}`;
		expect((await page.goto('/admin/settings/payments'))?.status()).toBe(403);
		const post = await page.request.post('/admin/settings/payments', {
			form: { feeAmount: '1', feeCurrency: 'AMD', feePeriodMonths: '1', waitMinutes: '5' },
			headers: ORIGIN
		});
		expect(post.status()).toBe(403);
		const [{ count }] = await sql`select count(*)::int from audit_log
			where actor_id = ${id} and action = 'settings.update'`;
		expect(count).toBe(0);
	});
}

test('admin: tabs link the two settings pages; the form shows the stored values', async ({
	page
}) => {
	await registerAdmin(page, sql, 'tabs');
	await page.goto('/admin/settings');
	await page.getByRole('link', { name: 'Membership and payments' }).click();
	await expect(page).toHaveURL('/admin/settings/payments');
	await expect(page.getByLabel('Membership fee amount')).toBeVisible();
	await expect(page.getByLabel('Term, months')).toBeVisible();
	await expect(page.getByLabel('Minimum donation')).toBeVisible();
	await expect(page.getByLabel('Maximum donation')).toBeVisible();

	await sql`insert into site_settings (key, value) values ('payment_wait_minutes', '47')
		on conflict (key) do update set value = excluded.value`;
	await page.reload();
	await expect(page.getByLabel('Payment wait, minutes')).toHaveValue('47');

	await page.getByRole('link', { name: 'Site', exact: true }).click();
	await expect(page).toHaveURL('/admin/settings');
});

test('admin: wrong values are refused at their fields and nothing is saved', async ({ page }) => {
	const id = await registerAdmin(page, sql, 'errors');
	await openPaymentSettings(page);
	await page.getByLabel('Minimum donation').fill('5000');
	await page.getByLabel('Maximum donation').fill('4000');
	await page.getByLabel('Term, months').fill('0');
	await page.getByLabel('Payment wait, minutes').fill('2');
	await page.getByRole('button', { name: 'Save' }).click();
	await expect(page.getByText('Nothing was saved. Fix the marked fields.')).toBeVisible();
	await expect(page.getByText('The maximum must not be below the minimum.')).toBeVisible();
	await expect(page.getByText('Enter a whole number of months from 1 to 120.')).toBeVisible();
	await expect(page.getByText('Enter a whole number of minutes from 5 to 1440.')).toBeVisible();
	await expect(page.getByLabel('Maximum donation')).toHaveValue('4000');
	const [{ count }] = await sql`select count(*)::int from audit_log
		where actor_id = ${id} and action = 'settings.update'`;
	expect(count).toBe(0);
});

test('admin: the payment wait is saved and logged with before and after', async ({ page }) => {
	const id = await registerAdmin(page, sql, 'wait');
	await sql`insert into site_settings (key, value) values ('payment_wait_minutes', '30')
		on conflict (key) do update set value = excluded.value`;
	await openPaymentSettings(page);
	await page.getByLabel('Payment wait, minutes').fill('40');
	await page.getByRole('button', { name: 'Save' }).click();
	await expect(page.getByText('Saved.')).toBeVisible();
	await expect(page.getByLabel('Payment wait, minutes')).toHaveValue('40');

	const [row] = await sql`select value from site_settings where key = 'payment_wait_minutes'`;
	expect(row.value).toBe(40);
	const [log] = await sql`
		select before, after from audit_log
		where actor_id = ${id} and action = 'settings.update' and after ? 'payment_wait_minutes'`;
	expect(log.before).toEqual({ payment_wait_minutes: 30 });
	expect(log.after).toEqual({ payment_wait_minutes: 40 });
});
