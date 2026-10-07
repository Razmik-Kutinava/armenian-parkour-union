import { existsSync } from 'node:fs';
import { expect, test, type Page } from '@playwright/test';
import postgres from 'postgres';

if (!process.env.DATABASE_URL && existsSync('.env')) process.loadEnvFile('.env');
const sql = postgres(process.env.DATABASE_URL ?? '', { max: 1, onnotice: () => {} });
test.afterAll(() => sql.end());
/* Only sign-up counters: auth.spec.ts runs in parallel and checks the sign-in limit. */
test.beforeEach(async () => {
	await sql`delete from rate_limit where key ~ '^sign-up:ip:(127\.0\.0\.1|::1|::ffff:127\.0\.0\.1)$'`;
});

async function registerAs(page: Page, role: 'member' | 'editor') {
	const email = `e2e-layout-${role}-${crypto.randomUUID()}@example.com`;
	await page.goto('/register');
	await page.getByLabel('Email').fill(email);
	await page.getByLabel('Password').fill('parkour-pass-1');
	await page.getByLabel('First name').fill('Layout');
	await page.getByLabel('Last name').fill(role);
	await page.getByLabel('Date of birth').fill('1990-01-01');
	await page.getByLabel(/privacy policy/).check();
	await page.getByRole('button', { name: 'Create account' }).click();
	await expect(page).toHaveURL('/');
	await sql`update users set role = ${role} where email = ${email}`;
}

test('guest sees the site menu, log in and join, footer page links', async ({ page }) => {
	await page.goto('/');
	const header = page.getByRole('banner');
	await expect(header.getByRole('link', { name: 'Armenian Parkour Union' })).toHaveAttribute(
		'href',
		'/'
	);
	for (const [name, href] of [
		['Events', '/events'],
		['News', '/news'],
		['Federation', '/federation'],
		['Shop', '/shop'],
		['Support', '/donate']
	]) {
		await expect(header.getByRole('link', { name, exact: true })).toHaveAttribute('href', href);
	}
	await expect(header.getByRole('link', { name: 'Log in' })).toHaveAttribute('href', '/login');
	await expect(header.getByRole('link', { name: 'Join' })).toHaveAttribute('href', '/join');

	const footer = page.getByRole('contentinfo');
	await expect(footer.getByRole('link', { name: 'About the federation' })).toHaveAttribute(
		'href',
		'/federation'
	);
	await expect(footer.getByRole('link', { name: 'Rules' })).toHaveAttribute('href', '/pages/rules');
	await expect(footer.getByRole('link', { name: 'Privacy policy' })).toHaveAttribute(
		'href',
		'/pages/privacy'
	);

	await expect(page.getByRole('link', { name: 'Skip to content' })).toHaveAttribute(
		'href',
		'#content'
	);
	await expect(page.locator('main#content')).toHaveCount(1);
});

test('language switcher keeps the page and changes <html lang>', async ({ page }) => {
	await page.goto('/ru/login');
	const header = page.getByRole('banner');
	await expect(header.getByRole('link', { name: 'События' })).toHaveAttribute('href', '/ru/events');
	await expect(header.getByRole('link', { name: 'Русский' })).toHaveAttribute(
		'aria-current',
		'true'
	);
	await expect(header.getByRole('link', { name: 'Հայերեն' })).toHaveAttribute('href', '/hy/login');

	await header.getByRole('link', { name: 'English' }).click();
	await expect(page).toHaveURL('/login');
	await expect(page.locator('html')).toHaveAttribute('lang', 'en');
	await expect(page.getByRole('heading', { name: 'Log in' })).toBeVisible();
});

test('member sees cabinet and log out, but no admin link', async ({ page }) => {
	await registerAs(page, 'member');
	await page.goto('/');
	const header = page.getByRole('banner');
	await expect(header.getByRole('link', { name: 'Log in' })).toHaveCount(0);
	await header.getByText('Layout member').click();
	await expect(header.getByRole('link', { name: 'Cabinet' })).toHaveAttribute('href', '/cabinet');
	await expect(header.getByRole('link', { name: 'Admin panel' })).toHaveCount(0);

	await header.getByRole('button', { name: 'Log out' }).click();
	await expect(page).toHaveURL('/');
	await expect(header.getByRole('link', { name: 'Log in' })).toBeVisible();
});

test('staff sees the admin link', async ({ page }) => {
	await registerAs(page, 'editor');
	await page.goto('/ru');
	const header = page.getByRole('banner');
	await header.getByText('Layout editor').click();
	await expect(header.getByRole('link', { name: 'Админка' })).toHaveAttribute('href', '/admin');
});

test('on a phone the menu opens from the menu button', async ({ page }) => {
	await page.setViewportSize({ width: 360, height: 740 });
	await page.goto('/');
	const header = page.getByRole('banner');
	await expect(header.getByRole('link', { name: 'Events' })).toBeHidden();
	await header.getByText('Menu').click();
	await expect(header.getByRole('link', { name: 'Events' })).toBeVisible();
});

test('unknown page gives a branded 404 with a link home in the page language', async ({ page }) => {
	const response = await page.goto('/no-such-page');
	expect(response?.status()).toBe(404);
	await expect(page.getByRole('heading', { name: 'Page not found' })).toBeVisible();
	await expect(page.getByRole('banner')).toBeVisible();
	await expect(page.getByRole('link', { name: 'Go to the home page' })).toHaveAttribute(
		'href',
		'/'
	);

	expect((await page.goto('/ru/no-such-page'))?.status()).toBe(404);
	await expect(page.getByRole('heading', { name: 'Страница не найдена' })).toBeVisible();
	await expect(page.getByRole('link', { name: 'На главную' })).toHaveAttribute('href', '/ru');
});

test('an expected error inside the site keeps the header and shows its message', async ({
	page
}) => {
	const response = await page.goto('/verify-email?token=broken');
	expect(response?.status()).toBe(400);
	await expect(page.getByRole('banner')).toBeVisible();
	await expect(page.getByText('This link is invalid or expired.')).toBeVisible();
});
