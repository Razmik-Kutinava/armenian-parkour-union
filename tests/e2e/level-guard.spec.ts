import { existsSync } from 'node:fs';
import { expect, test, type Locator, type Page } from '@playwright/test';
import postgres from 'postgres';
import { hydrated } from './hydrated';

/* docs/03 sections 3.2, 15, roadmap 6.10: a member cannot give themselves a level or a role — not
 * through the Better Auth HTTP API (only the Google callback is mounted; other paths fall to the
 * site pages: 404, or 405 for a page without actions) and not by adding fields
 * to the sign-up or profile form. The account stays in parkour_dev (global setup soft-deletes it). */

if (!process.env.DATABASE_URL && existsSync('.env')) process.loadEnvFile('.env');
const sql = postgres(process.env.DATABASE_URL ?? '', { max: 1, onnotice: () => {} });
test.afterAll(() => sql.end());

test.beforeEach(async () => {
	await sql`delete from rate_limit where key ~ '^sign-up:ip:(127\.0\.0\.1|::1|::ffff:127\.0\.0\.1)$'`;
});

const FORGED = { level: 'pro', role: 'admin', status: 'active', pointsBalance: '1000' };

/** Adds hidden fields to the form, as a hand-made request would. */
async function forge(form: Locator) {
	await form.evaluate((el, fields) => {
		for (const [name, value] of Object.entries(fields)) {
			const input = document.createElement('input');
			Object.assign(input, { type: 'hidden', name, value });
			el.appendChild(input);
		}
	}, FORGED);
}

async function accountOf(email: string) {
	const [row] = await sql`select id, level, role, points_balance from users where email = ${email}`;
	return row;
}

async function registerForged(page: Page) {
	const email = `e2e-level-${crypto.randomUUID()}@example.com`;
	await page.goto('/register');
	await hydrated(page);
	await page.getByLabel('Email').fill(email);
	await page.getByLabel('Password').fill('parkour-pass-1');
	await page.getByLabel('First name').fill('Level');
	await page.getByLabel('Last name').fill('Guard');
	await page.getByLabel('Date of birth').fill('1990-01-01');
	await page.getByLabel(/privacy policy/).check();
	const submit = page.getByRole('button', { name: 'Create account' });
	await forge(page.locator('form', { has: submit }));
	await submit.click();
	await expect(page).toHaveURL('/cabinet');
	return email;
}

test('sign-up with forged level and role: a plain member without a level', async ({ page }) => {
	const email = await registerForged(page);
	expect(await accountOf(email)).toMatchObject({ level: null, role: 'member', points_balance: 0 });
});

test('profile form with a forged level: saved, the level and role unchanged', async ({ page }) => {
	const email = await registerForged(page);
	await page.goto('/cabinet/profile');
	await hydrated(page);
	const main = page.locator('main');
	await main.getByLabel('City').fill('Vanadzor');
	const save = page.getByRole('button', { name: 'Save' });
	await forge(main.locator('form', { has: save }));
	await main.getByRole('button', { name: 'Save' }).click();
	await expect(main.getByText('Profile saved.')).toBeVisible();
	expect(await accountOf(email)).toMatchObject({ level: null, role: 'member', points_balance: 0 });
});

test('Better Auth API for sign-up and profile is not mounted, with or without a session', async ({
	page
}) => {
	const email = await registerForged(page);
	const body = { email: `e2e-level-${crypto.randomUUID()}@example.com`, password: 'x', ...FORGED };
	for (const path of ['/api/auth/update-user', '/api/auth/sign-up/email']) {
		const res = await page.request.post(path, { data: body });
		expect([404, 405], path).toContain(res.status());
	}
	expect(await accountOf(email)).toMatchObject({ level: null, role: 'member' });
	expect(await accountOf(body.email)).toBeUndefined();
});
