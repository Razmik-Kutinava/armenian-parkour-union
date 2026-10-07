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

type Role = 'member' | 'editor' | 'moderator' | 'admin';

async function registerAs(page: Page, role: Role) {
	const email = `e2e-shell-${role}-${crypto.randomUUID()}@example.com`;
	await page.goto('/register');
	await page.getByLabel('Email').fill(email);
	await page.getByLabel('Password').fill('parkour-pass-1');
	await page.getByLabel('First name').fill('Shell');
	await page.getByLabel('Last name').fill(role);
	await page.getByLabel('Date of birth').fill('1990-01-01');
	await page.getByLabel(/privacy policy/).check();
	await page.getByRole('button', { name: 'Create account' }).click();
	await expect(page).toHaveURL('/');
	await sql`update users set role = ${role} where email = ${email}`;
	return email;
}

const sidebar = (page: Page) => page.getByRole('navigation', { name: 'Admin sections' });

test('editor sees content sections only', async ({ page }) => {
	await registerAs(page, 'editor');
	await page.goto('/admin');
	const nav = sidebar(page);
	await expect(nav.getByRole('link', { name: 'Dashboard' })).toHaveAttribute('aria-current', 'page');
	await expect(nav.getByRole('link', { name: 'News' })).toHaveAttribute('href', '/admin/news');
	await expect(nav.getByRole('link', { name: 'Users' })).toHaveCount(0);
	await expect(nav.getByRole('link', { name: 'Site settings' })).toHaveCount(0);
});

test('moderator sees members and moderation, not content or system', async ({ page }) => {
	await registerAs(page, 'moderator');
	await page.goto('/admin');
	const nav = sidebar(page);
	await expect(nav.getByRole('link', { name: 'Users' })).toHaveAttribute('href', '/admin/users');
	await expect(nav.getByRole('link', { name: 'Videos' })).toBeVisible();
	await expect(nav.getByRole('link', { name: 'News' })).toHaveCount(0);
	await expect(nav.getByRole('link', { name: 'Audit log' })).toHaveCount(0);
});

test('admin sees the system group', async ({ page }) => {
	await registerAs(page, 'admin');
	await page.goto('/admin');
	const nav = sidebar(page);
	for (const name of ['Site settings', 'Audit log', 'Admins and roles', 'Payments']) {
		await expect(nav.getByRole('link', { name })).toBeVisible();
	}
	await expect(page.getByRole('navigation', { name: 'Breadcrumbs' })).toContainText('Admin panel');
});

test('language from the profile, switched in the user menu and kept', async ({ page }) => {
	const email = await registerAs(page, 'editor');
	await page.goto('/admin');
	await expect(page.locator('html')).toHaveAttribute('lang', 'en');

	await page.getByRole('banner').getByText('Shell editor').click();
	await page.getByRole('button', { name: 'Русский' }).click();
	await expect(page).toHaveURL('/admin');
	await expect(page.getByRole('heading', { name: 'Админ-панель' })).toBeVisible();
	await expect(page.locator('html')).toHaveAttribute('lang', 'ru');

	await page.reload();
	await expect(page.getByRole('heading', { name: 'Админ-панель' })).toBeVisible();
	const [row] = await sql`select locale from users where email = ${email}`;
	expect(row.locale).toBe('ru');
});

test('locale action: only own profile, valid locale, return inside /admin', async ({ page }) => {
	const email = await registerAs(page, 'editor');
	const post = (form: Record<string, string>) =>
		page.request.post('/admin/locale', {
			form,
			headers: { origin: 'http://localhost:4173' },
			maxRedirects: 0
		});

	expect((await post({ locale: 'de', returnTo: '/admin' })).status()).toBe(400);
	const outside = await post({ locale: 'hy', returnTo: 'https://evil.example/' });
	expect(outside.status()).toBe(303);
	expect(outside.headers()['location']).toBe('/admin');
	const site = await post({ locale: 'hy', returnTo: '/login' });
	expect(site.headers()['location']).toBe('/admin');
	const [row] = await sql`select locale from users where email = ${email}`;
	expect(row.locale).toBe('hy');
});

test('member cannot change the language through the admin action', async ({ page }) => {
	await registerAs(page, 'member');
	const res = await page.request.post('/admin/locale', {
		form: { locale: 'hy', returnTo: '/admin' },
		headers: { origin: 'http://localhost:4173' },
		maxRedirects: 0
	});
	expect(res.status()).toBe(404);
});

test('on a phone the sidebar opens from the menu button', async ({ page }) => {
	await registerAs(page, 'editor');
	await page.setViewportSize({ width: 360, height: 740 });
	await page.goto('/admin');
	await expect(sidebar(page).getByRole('link', { name: 'News' })).toBeHidden();
	await page.getByRole('button', { name: 'Menu' }).click();
	await expect(sidebar(page).getByRole('link', { name: 'News' })).toBeVisible();
});
