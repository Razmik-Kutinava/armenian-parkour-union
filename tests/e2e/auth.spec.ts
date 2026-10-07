import { existsSync } from 'node:fs';
import { expect, test, type Page } from '@playwright/test';
import postgres from 'postgres';

if (!process.env.DATABASE_URL && existsSync('.env')) process.loadEnvFile('.env');
const sql = postgres(process.env.DATABASE_URL ?? '', { max: 1, onnotice: () => {} });
test.afterAll(() => sql.end());

/* All tests come from one local address: start each with fresh attempt counters for it. */
test.beforeEach(async () => {
	await sql`delete from rate_limit where key ~ ':ip:(127\.0\.0\.1|::1|::ffff:127\.0\.0\.1)$'`;
});

const PASSWORD = 'parkour-pass-1';
const newEmail = () => `e2e-${crypto.randomUUID()}@example.com`;

async function hasSession(page: Page) {
	const cookies = await page.context().cookies();
	return cookies.some((c) => c.name.endsWith('session_token'));
}

async function fillRegistration(page: Page, email: string, birthDate = '1995-04-20') {
	await page.goto('/register');
	await page.getByLabel('Email').fill(email);
	await page.getByLabel('Password').fill(PASSWORD);
	await page.getByLabel('First name').fill('Test');
	await page.getByLabel('Last name').fill('Runner');
	await page.getByLabel('Date of birth').fill(birthDate);
	await page.getByLabel(/privacy policy/).check();
}

async function register(page: Page, email: string) {
	await fillRegistration(page, email);
	await page.getByRole('button', { name: 'Create account' }).click();
	await expect(page).toHaveURL('/');
	expect(await hasSession(page)).toBe(true);
}

async function logIn(page: Page, email: string, password = PASSWORD, path = '/login') {
	await page.goto(path);
	await page.getByLabel('Email').fill(email);
	await page.getByLabel('Password').fill(password);
	await page.getByRole('button', { name: 'Log in' }).click();
}

async function logOut(page: Page) {
	await page.goto('/logout');
	await page.getByRole('button', { name: 'Log out' }).click();
	await expect.poll(() => hasSession(page)).toBe(false);
}

test('adult registers, logs out and logs back in', async ({ page }) => {
	const email = newEmail();
	await register(page, email);

	await logOut(page);
	await logIn(page, email, 'wrong-password');
	await expect(page.getByText('Wrong email or password')).toBeVisible();
	expect(await hasSession(page)).toBe(false);

	await logIn(page, email);
	await expect(page).toHaveURL('/');
	expect(await hasSession(page)).toBe(true);
});

test('minor cannot register without parent data, entered values stay', async ({ page }) => {
	await fillRegistration(page, newEmail(), '2013-06-01');
	await page.getByRole('button', { name: 'Create account' }).click();
	await expect(page.getByLabel('Parent or guardian name')).toHaveAttribute('aria-invalid', 'true');
	await expect(page.getByLabel('Parent or guardian phone')).toHaveAttribute('aria-invalid', 'true');
	await expect(page.getByLabel('First name')).toHaveValue('Test');
	expect(await hasSession(page)).toBe(false);
});

test('return address after login stays on the site', async ({ page }) => {
	const email = newEmail();
	await register(page, email);
	await logOut(page);
	await logIn(page, email, PASSWORD, '/login?returnTo=//evil.example');
	await expect(page).toHaveURL('/');
	await logOut(page);
	await logIn(page, email, PASSWORD, '/login?returnTo=%2Fhy');
	await expect(page).toHaveURL('/hy');
});

test('blocked user cannot log in even with the right password', async ({ page }) => {
	const email = newEmail();
	await register(page, email);
	await logOut(page);
	await sql`update users set status = 'blocked' where email = ${email}`;
	await logIn(page, email);
	await expect(page.getByText('This account is blocked')).toBeVisible();
	expect(await hasSession(page)).toBe(false);
});

test('sixth login attempt in a minute is refused', async ({ page }) => {
	const email = newEmail();
	for (let i = 0; i < 5; i++) {
		await logIn(page, email, 'wrong-password');
		await expect(page.getByText('Wrong email or password')).toBeVisible();
	}
	await logIn(page, email, 'wrong-password');
	await expect(page.getByText('Too many attempts')).toBeVisible();
});

test('password reset by link sets a new password', async ({ page }) => {
	const email = newEmail();
	await register(page, email);
	await logOut(page);

	await page.goto('/forgot-password');
	await page.getByLabel('Email').fill(email);
	await page.getByRole('button', { name: 'Send link' }).click();
	await expect(page.getByText('If this email is registered')).toBeVisible();

	const [row] = await sql`
		select v.identifier from verification v join users u on u.id::text = v.value
		where u.email = ${email} and v.identifier like 'reset-password:%'`;
	const token = String(row.identifier).slice('reset-password:'.length);
	await page.goto(`/reset-password?token=${token}`);
	await page.getByLabel('New password').fill('brand-new-pass');
	await page.getByRole('button', { name: 'Save password' }).click();
	await expect(page.getByText('Password changed')).toBeVisible();

	await logIn(page, email, 'brand-new-pass');
	await expect(page).toHaveURL('/');
	expect(await hasSession(page)).toBe(true);
});

test('broken verification link shows an error, not a crash', async ({ page }) => {
	const response = await page.goto('/verify-email?token=broken');
	expect(response?.status()).toBe(400);
	await expect(page.getByText('link is invalid or expired')).toBeVisible();
});
