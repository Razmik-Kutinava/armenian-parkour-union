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

async function registerAs(page: Page, role: 'member' | 'editor' | 'moderator' | 'admin') {
	const email = `e2e-${role}-${crypto.randomUUID()}@example.com`;
	await page.goto('/register');
	await page.getByLabel('Email').fill(email);
	await page.getByLabel('Password').fill('parkour-pass-1');
	await page.getByLabel('First name').fill('Test');
	await page.getByLabel('Last name').fill(role);
	await page.getByLabel('Date of birth').fill('1990-01-01');
	await page.getByLabel(/privacy policy/).check();
	await page.getByRole('button', { name: 'Create account' }).click();
	await expect(page).toHaveURL('/');
	await sql`update users set role = ${role} where email = ${email}`;
	return email;
}

test('guest opening /admin is sent to login and comes back after it', async ({ page }) => {
	await page.goto('/admin');
	await expect(page).toHaveURL('/login?returnTo=%2Fadmin');
});

test('member gets 404 for /admin, page and direct POST alike', async ({ page }) => {
	await registerAs(page, 'member');
	const response = await page.goto('/admin');
	expect(response?.status()).toBe(404);
	const post = await page.request.post('/admin', {
		form: { anything: '1' },
		headers: { origin: 'http://localhost:4173' }
	});
	expect([403, 404, 405]).toContain(post.status());
});

for (const role of ['editor', 'moderator', 'admin'] as const) {
	test(`${role} opens the admin panel`, async ({ page }) => {
		await registerAs(page, role);
		const response = await page.goto('/admin');
		expect(response?.status()).toBe(200);
		await expect(page.getByRole('heading', { name: 'Admin panel' })).toBeVisible();
	});
}

test('demoted staff loses /admin on the next request', async ({ page }) => {
	const email = await registerAs(page, 'editor');
	expect((await page.goto('/admin'))?.status()).toBe(200);
	await sql`update users set role = 'member' where email = ${email}`;
	expect((await page.goto('/admin'))?.status()).toBe(404);
});
