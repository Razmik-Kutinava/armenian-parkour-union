import { existsSync } from 'node:fs';
import { expect, test, type Page } from '@playwright/test';
import postgres from 'postgres';

/* docs/05 sections 16-17, docs/07 sections 9, 11, 12: an admin records a transfer as paid, finds
 * it, refunds it, exports it; "needs review" is a filter and is cleared with a comment; donation
 * purposes are created and hidden. */

if (!process.env.DATABASE_URL && existsSync('.env')) process.loadEnvFile('.env');
const sql = postgres(process.env.DATABASE_URL ?? '', { max: 1, onnotice: () => {} });
const TAG = crypto.randomUUID().slice(0, 8);
const ORIGIN = { origin: 'http://localhost:4173' };

test.afterAll(async () => {
	await sql`delete from donation_purposes where title->>'en' like ${`%${TAG}%`}`;
	await sql.end();
});
test.beforeEach(async () => {
	await sql`delete from rate_limit where key ~ '^sign-up:ip:(127\.0\.0\.1|::1|::ffff:127\.0\.0\.1)$'`;
});

async function registerAdmin(page: Page) {
	const email = `e2e-payadmin-${crypto.randomUUID()}@example.com`;
	await page.goto('/register');
	await page.getByLabel('Email').fill(email);
	await page.getByLabel('Password').fill('parkour-pass-1');
	await page.getByLabel('First name').fill('Pay');
	await page.getByLabel('Last name').fill('Admin');
	await page.getByLabel('Date of birth').fill('1990-01-01');
	await page.getByLabel(/privacy policy/).check();
	await page.getByRole('button', { name: 'Create account' }).click();
	await expect(page).toHaveURL('/cabinet');
	await sql`update users set role = 'admin' where email = ${email}`;
}

test('manual donation: recorded as paid, found in the list, refunded, exported', async ({
	page
}) => {
	await registerAdmin(page);
	const donor = `Cash ${TAG}`;
	await page.goto('/admin/payments/new');
	await page.getByLabel('Type').selectOption('donation');
	await page.getByLabel('Amount').fill('12000');
	await page.getByLabel('Payment date').fill('2026-01-15');
	await page.getByLabel(/Comment/).fill(`Transfer ${TAG}`);
	await page.getByLabel('Donor name').fill(donor);
	await page.getByRole('button', { name: 'Record as paid' }).click();
	await expect(page).toHaveURL(/\/admin\/payments\/[0-9a-f-]{36}/);
	const id = page.url().split('/').pop()!.split('?')[0];
	await expect(page.getByText('The payment has been recorded.')).toBeVisible();
	await expect(page.locator('main')).toContainText('manual');
	await expect(page.locator('main')).toContainText(`Transfer ${TAG}`);

	await page.goto(`/admin/payments?q=${encodeURIComponent(donor)}`);
	await expect(page.getByRole('link', { name: donor, exact: true })).toBeVisible();

	const csv = await page.request.get(
		'/admin/payments/export?kind=donation&from=2026-01-15&to=2026-01-15'
	);
	expect(csv.headers()['content-type']).toContain('text/csv');
	expect(await csv.text()).toContain(id);
	const fees = await page.request.get('/admin/payments/export?kind=membership&from=2026-01-15');
	expect(await fees.text()).not.toContain(id);
	expect((await page.request.get('/admin/payments/export')).status()).toBe(400);

	const refund = await page.request.post(`/admin/payments/${id}?/refund`, {
		form: { comment: 'Returned in cash' },
		headers: ORIGIN
	});
	expect(refund.ok()).toBe(true);
	await page.goto(`/admin/payments/${id}`);
	await expect(page.locator('main')).toContainText('Refunded');
	const [row] = await sql`select status, refunded_at from payments where id = ${id}`;
	expect(row.status).toBe('refunded');
	expect(row.refunded_at).not.toBeNull();
});

test('type and currency chosen before the page is interactive are kept', async ({ page }) => {
	await registerAdmin(page);
	let release = () => {};
	const scripts = new Promise<void>((resolve) => (release = resolve));
	await page.route('**/_app/immutable/**/*.js', async (route) => {
		await scripts;
		await route.continue();
	});
	await page.goto('/admin/payments/new', { waitUntil: 'domcontentloaded' });
	await page.getByLabel('Type').selectOption('membership');
	await page.getByLabel('Currency').selectOption('USD');
	release();
	await page.locator('html[data-hydrated]').waitFor({ state: 'attached' });
	await expect(page.getByLabel('Type')).toHaveValue('membership');
	await expect(page.getByLabel('Currency')).toHaveValue('USD');
	await expect(page.getByLabel('Donor name')).toHaveCount(0);
});

test('needs review: shown by the filter, cleared with a comment', async ({ page }) => {
	await registerAdmin(page);
	const donor = `Review ${TAG}`;
	const [payment] = await sql`
		insert into payments (kind, status, amount_minor, currency, provider, donor_name,
			failure_reason, needs_review)
		values ('donation', 'failed', 7000, 'AMD', 'manual', ${donor}, 'amount_mismatch', true)
		returning id`;
	const list = `/admin/payments?review=1&q=${encodeURIComponent(donor)}`;
	await page.goto(list);
	await expect(page.getByRole('link', { name: donor, exact: true })).toBeVisible();
	await page.goto(`/admin/payments/${payment.id}`);
	await expect(page.locator('main')).toContainText('amount_mismatch');
	await expect(page.getByRole('button', { name: 'Mark as reviewed' })).toBeVisible();
	const resolve = await page.request.post(`/admin/payments/${payment.id}?/resolve`, {
		form: { comment: 'Checked with the bank' },
		headers: ORIGIN
	});
	expect(resolve.ok()).toBe(true);
	await page.goto(list);
	await expect(page.getByRole('link', { name: donor, exact: true })).toHaveCount(0);
});

test('donation purposes: created with three languages, then hidden', async ({ page }) => {
	await registerAdmin(page);
	const title = `Park ${TAG}`;
	await page.goto('/admin/donation-purposes/new');
	await page.getByLabel('Title (English)').fill(title);
	await page.getByRole('button', { name: 'Save' }).click();
	await expect(page).toHaveURL(/\/admin\/donation-purposes\/[0-9a-f-]{36}/);
	await page.goto('/admin/donation-purposes');
	const row = page.getByRole('row', { name: new RegExp(title) });
	await expect(row).toContainText('Yes');
	const [purpose] =
		await sql`select id, is_active from donation_purposes where title->>'en' = ${title}`;
	expect(purpose.is_active).toBe(true);
	const hide = await page.request.post(`/admin/donation-purposes/${purpose.id}?/update`, {
		form: { 'title.en': title },
		headers: ORIGIN
	});
	expect(hide.ok()).toBe(true);
	await page.reload();
	await expect(row).toContainText('Hidden');
});
