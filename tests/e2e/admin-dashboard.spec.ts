import { existsSync } from 'node:fs';
import { expect, test, type Page } from '@playwright/test';
import postgres from 'postgres';

/* docs/05 section 3: the dashboard shows each block only to the role with the right to it
 * (docs/04 section 5.1): editor — events and the home page; moderator — the queues without money;
 * admin — everything, statistics and sign-ups included. */

if (!process.env.DATABASE_URL && existsSync('.env')) process.loadEnvFile('.env');
const sql = postgres(process.env.DATABASE_URL ?? '', { max: 1, onnotice: () => {} });
test.afterAll(() => sql.end());
test.beforeEach(async () => {
	await sql`delete from rate_limit where key ~ '^sign-up:ip:(127\.0\.0\.1|::1|::ffff:127\.0\.0\.1)$'`;
});

type Role = 'editor' | 'moderator' | 'admin';

async function openAs(page: Page, role: Role) {
	const email = `e2e-dash-${role}-${crypto.randomUUID()}@example.com`;
	await page.goto('/register');
	await page.getByLabel('Email').fill(email);
	await page.getByLabel('Password').fill('parkour-pass-1');
	await page.getByLabel('First name').fill('Dash');
	await page.getByLabel('Last name').fill(role);
	await page.getByLabel('Date of birth').fill('1990-01-01');
	await page.getByLabel(/privacy policy/).check();
	await page.getByRole('button', { name: 'Create account' }).click();
	await expect(page).toHaveURL('/cabinet');
	await sql`update users set role = ${role} where email = ${email}`;
	await page.goto('/admin');
}

const block = (page: Page, name: string) => page.getByRole('region', { name });

test('editor: upcoming events and the home page, no queues or statistics', async ({ page }) => {
	await openAs(page, 'editor');
	await expect(block(page, 'Upcoming events')).toBeVisible();
	await expect(block(page, 'Home page now')).toBeVisible();
	await expect(
		block(page, 'Home page now').getByRole('link', { name: 'Manage the home page' })
	).toHaveAttribute('href', '/admin/hero');
	for (const name of ['Needs action', 'Short statistics', 'Latest sign-ups', 'Suspicious points']) {
		await expect(block(page, name)).toHaveCount(0);
	}
});

test('moderator: queues with links, no payments, statistics or home page', async ({ page }) => {
	await openAs(page, 'moderator');
	const queues = block(page, 'Needs action');
	await expect(queues.getByRole('link', { name: /Videos to review/ })).toHaveAttribute(
		'href',
		'/admin/videos'
	);
	await expect(queues.getByRole('link', { name: /New orders/ })).toHaveAttribute(
		'href',
		'/admin/orders?status=new'
	);
	await expect(queues.getByRole('link', { name: /Payments to check/ })).toHaveCount(0);
	for (const name of ['Home page now', 'Short statistics', 'Latest sign-ups']) {
		await expect(block(page, name)).toHaveCount(0);
	}
});

test('admin: every block, payments to check and statistics', async ({ page }) => {
	await openAs(page, 'admin');
	await expect(
		block(page, 'Needs action').getByRole('link', { name: /Payments to check/ })
	).toHaveAttribute('href', '/admin/payments?review=1');
	for (const name of [
		'Upcoming events',
		'Home page now',
		'Short statistics',
		'Suspicious points',
		'Latest sign-ups'
	]) {
		await expect(block(page, name)).toBeVisible();
	}
	await expect(
		block(page, 'Suspicious points').getByRole('link', { name: 'Open in the ledger' })
	).toHaveAttribute('href', /^\/admin\/points\?suspicious=1&from=\d{4}-\d{2}-\d{2}$/);
});
