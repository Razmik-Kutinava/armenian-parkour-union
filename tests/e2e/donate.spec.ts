import { existsSync } from 'node:fs';
import { expect, test, type Page } from '@playwright/test';
import postgres from 'postgres';
import { openPaymentSettings, registerAdmin } from './payment-settings-form';

/* docs/06 section 4.8, docs/07 section 5.2: /donate for guests and members, the server checks the
 * amount range, the public list only behind the flag and never with an email. The e2e server is a
 * production build: no online provider, so a valid form ends with "not available". */

if (!process.env.DATABASE_URL && existsSync('.env')) process.loadEnvFile('.env');
const sql = postgres(process.env.DATABASE_URL ?? '', { max: 1, onnotice: () => {} });

const LIMITS = { currency: 'AMD', min_minor: 1000, max_minor: 1_000_000 };
const TAG = crypto.randomUUID().slice(0, 8);
const PURPOSE = `E2E purpose ${TAG}`;
const saved: Record<string, unknown> = {};
let purposeId = '';

test.describe.configure({ mode: 'serial' });

async function setSetting(key: string, value: unknown) {
	await sql`insert into site_settings (key, value) values (${key}, ${sql.json(value as never)})
		on conflict (key) do update set value = excluded.value`;
}

test.beforeAll(async () => {
	for (const key of ['donation_limits', 'feature_flags']) {
		const [row] = await sql`select value from site_settings where key = ${key}`;
		saved[key] = row?.value;
	}
	await setSetting('donation_limits', LIMITS);
	const [purpose] = await sql`insert into donation_purposes (title, sort_order)
		values (${sql.json({ en: PURPOSE })}, -100000) returning id`;
	purposeId = purpose.id;
});

test.afterAll(async () => {
	for (const [key, value] of Object.entries(saved)) {
		if (value === undefined) await sql`delete from site_settings where key = ${key}`;
		else await setSetting(key, value);
	}
	await sql`delete from payments where donor_name like ${`%${TAG}%`}`;
	await sql`delete from donation_purposes where id = ${purposeId}`;
	await sql.end();
});

test.beforeEach(async () => {
	await sql`delete from rate_limit where key ~ '^(sign-up|donate):ip:'`;
});

const donorEmail = () => `e2e-donate-${crypto.randomUUID()}@example.com`;

async function fillGuest(page: Page, amount: string, email: string) {
	const main = page.locator('main');
	await main.getByLabel(/Amount/).fill(amount);
	await main.getByLabel('Your name').fill(`Guest ${TAG}`);
	await main.getByLabel('Email').fill(email);
}

test('guest: the header leads to /donate; form with quick amounts, range and purposes', async ({
	page
}) => {
	await page.goto('/');
	await page.locator('header').getByRole('link', { name: 'Support' }).first().click();
	await expect(page).toHaveURL('/donate');
	const main = page.locator('main');
	await expect(main.getByRole('heading', { level: 1 })).toBeVisible();
	await expect(main.getByText(/1,000.*1,000,000/)).toBeVisible();
	await main.getByRole('button', { name: /5,000/ }).click();
	await expect(main.getByLabel(/Amount/)).toHaveValue('5000');
	await expect(main.getByLabel('Purpose')).toContainText(PURPOSE);
	await expect(main.getByLabel('Your name')).toBeVisible();
	await expect(main.getByLabel(/Do not show my name/)).toBeVisible();
});

test('guest: amount below the minimum and missing contacts are refused on the server', async ({
	page
}) => {
	const email = donorEmail();
	await page.goto('/donate');
	const main = page.locator('main');
	await main.getByLabel(/Amount/).fill('999');
	await main.getByRole('button', { name: 'Donate' }).click();
	await expect(main.getByText('Fill in this field.')).toBeVisible();
	await expect(main.getByText('Enter a valid email.')).toBeVisible();
	await fillGuest(page, '999', email);
	await main.getByRole('button', { name: 'Donate' }).click();
	await expect(main.getByText(/from AMD\s?1,000 to AMD\s?1,000,000/)).toBeVisible();
	const [{ count }] = await sql`select count(*)::int from payments where donor_email = ${email}`;
	expect(count).toBe(0);
});

test('guest: a valid donation with online payment off — a clear message, no payment', async ({
	page
}) => {
	const email = donorEmail();
	await page.goto('/donate');
	await fillGuest(page, '10 000', email);
	await page.locator('main').getByLabel('Purpose').selectOption(purposeId);
	await page.locator('main').getByRole('button', { name: 'Donate' }).click();
	await expect(page.locator('main').getByText(/not available right now/)).toBeVisible();
	const [{ count }] = await sql`select count(*)::int from payments where donor_email = ${email}`;
	expect(count).toBe(0);
});

test('public list: hidden without the flag; with it — names and amounts, no emails', async ({
	page
}) => {
	const day = sql`now() + interval '2 days'`;
	await sql`insert into payments (kind, status, amount_minor, currency, provider, donor_name,
		donor_email, is_anonymous, paid_at) values
		('donation', 'paid', 7000, 'AMD', 'manual', ${`Named ${TAG}`}, ${`named-${TAG}@example.com`}, false, ${day}),
		('donation', 'paid', 9000, 'AMD', 'manual', ${`Secret ${TAG}`}, ${`secret-${TAG}@example.com`}, true, ${day})`;
	await setSetting('feature_flags', {
		...(saved.feature_flags ?? {}),
		donations_public_list: false
	});
	await page.goto('/donate');
	await expect(page.locator('main').getByText(`Named ${TAG}`)).toHaveCount(0);

	await setSetting('feature_flags', {
		...(saved.feature_flags ?? {}),
		donations_public_list: true
	});
	await page.goto('/donate');
	const list = page.locator('main').getByRole('list', { name: 'Recent donations' });
	await expect(list.getByText(`Named ${TAG}`)).toBeVisible();
	await expect(list.getByText(/7,000/)).toBeVisible();
	await expect(list.getByText('Anonymous').first()).toBeVisible();
	await expect(page.locator('main').getByText(`Secret ${TAG}`)).toHaveCount(0);
	expect(await page.content()).not.toContain(`@example.com`);
});

test('donations not configured: "will open soon", no form', async ({ page }) => {
	await sql`delete from site_settings where key = 'donation_limits'`;
	await page.goto('/donate');
	const main = page.locator('main');
	await expect(main.getByText(/will open soon/)).toBeVisible();
	await expect(main.getByRole('button', { name: 'Donate' })).toHaveCount(0);
	await setSetting('donation_limits', LIMITS);
});

test('member: no name and email fields, the account is shown instead', async ({ page }) => {
	const email = `e2e-donate-member-${crypto.randomUUID()}@example.com`;
	await page.goto('/register');
	await page.getByLabel('Email').fill(email);
	await page.getByLabel('Password').fill('parkour-pass-1');
	await page.getByLabel('First name').fill('Donor');
	await page.getByLabel('Last name').fill(TAG);
	await page.getByLabel('Date of birth').fill('1990-01-01');
	await page.getByLabel(/privacy policy/).check();
	await page.getByRole('button', { name: 'Create account' }).click();
	await expect(page).toHaveURL('/');
	await page.goto('/donate');
	const main = page.locator('main');
	await expect(main.getByText(email)).toBeVisible();
	await expect(main.getByLabel('Your name')).toHaveCount(0);
	await expect(main.getByLabel('Email')).toHaveCount(0);
});

/* Last in the file: changes the limits the tests above rely on; afterAll restores them. */
test('admin: new limits in the settings show on /donate and bind the server', async ({ page }) => {
	await registerAdmin(page, sql, TAG);
	await openPaymentSettings(page);
	await expect(page.getByLabel('Minimum donation')).toHaveValue('1000');
	await page.getByLabel('Minimum donation').fill('2000');
	await page.getByLabel('Maximum donation').fill('300000');
	await page.getByRole('button', { name: 'Save' }).click();
	await expect(page.getByText('Saved.')).toBeVisible();

	await page.context().clearCookies();
	await page.goto('/donate');
	const main = page.locator('main');
	await expect(main.getByText(/2,000.*300,000/)).toBeVisible();
	await fillGuest(page, '1500', donorEmail());
	await main.getByRole('button', { name: 'Donate' }).click();
	await expect(main.getByText(/from AMD\s?2,000 to AMD\s?300,000/)).toBeVisible();
});
