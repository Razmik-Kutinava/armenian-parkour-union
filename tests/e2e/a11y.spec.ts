import { existsSync } from 'node:fs';
import { expect, test, type Page } from '@playwright/test';
import postgres from 'postgres';
import { lowContrast, structureIssues } from './a11y-checks';
import { hydrated } from './hydrated';

/* Roadmap 8.5, docs/08 section 12: keyboard, screen reader structure, contrast, reduced motion. */

if (!process.env.DATABASE_URL && existsSync('.env')) process.loadEnvFile('.env');
const sql = postgres(process.env.DATABASE_URL ?? '', { max: 1, onnotice: () => {} });
test.afterAll(() => sql.end());
test.beforeEach(async () => {
	await sql`delete from rate_limit where key ~ '^sign-up:ip:(127\.0\.0\.1|::1|::ffff:127\.0\.0\.1)$'`;
});

const PUBLIC = ['/', '/events', '/news', '/shop', '/federation', '/federation/team', '/join'];
const AUTH = ['/donate', '/login', '/register', '/forgot-password', '/ru/events', '/hy'];
const CABINET = ['/cabinet', '/cabinet/profile', '/cabinet/membership', '/cabinet/documents'];
const ADMIN = ['/admin', '/admin/events', '/admin/news', '/admin/hero', '/admin/users'];
const ADMIN_MORE = ['/admin/payments', '/admin/exams', '/admin/certificates', '/admin/settings'];

async function registerAdmin(page: Page) {
	const email = `e2e-a11y-${crypto.randomUUID()}@example.com`;
	await page.goto('/register');
	await hydrated(page);
	await page.getByLabel('Email').fill(email);
	await page.getByLabel('Password').fill('parkour-pass-1');
	await page.getByLabel('First name').fill('Ally');
	await page.getByLabel('Last name').fill('Keys');
	await page.getByLabel('Date of birth').fill('1990-01-01');
	await page.getByLabel(/privacy policy/).check();
	await page.getByRole('button', { name: 'Create account' }).click();
	await expect(page).toHaveURL('/cabinet');
	await sql`update users set role = 'admin' where email = ${email}`;
}

async function expectAccessible(page: Page, paths: string[]) {
	for (const path of paths) {
		await page.goto(path);
		expect.soft(await lowContrast(page), `contrast on ${path}`).toEqual([]);
		expect.soft(await structureIssues(page), `structure of ${path}`).toEqual([]);
	}
}

test('keyboard: the first Tab shows the skip link, Enter moves focus to the content', async ({
	page
}) => {
	for (const path of ['/', '/events']) {
		await page.goto(path);
		await hydrated(page);
		await page.keyboard.press('Tab');
		const skip = page.getByRole('link', { name: 'Skip to content' });
		await expect(skip).toBeFocused();
		expect((await skip.boundingBox())?.width ?? 0).toBeGreaterThan(20);
		await page.keyboard.press('Enter');
		await expect(page.locator('main#content')).toBeFocused();
	}
});

test('public pages: text contrast AA, landmarks, heading order', async ({ page }) => {
	await expectAccessible(page, PUBLIC);
});

test('auth pages and other languages: text contrast AA, landmarks, heading order', async ({
	page
}) => {
	await expectAccessible(page, AUTH);
});

test('cabinet (email not confirmed yet): contrast, landmarks, the banner inside main', async ({
	page
}) => {
	test.slow();
	await registerAdmin(page);
	await expect(
		page.locator('main').getByText('Confirm your email to pay the fee and register for events.')
	).toBeVisible();
	await expectAccessible(page, CABINET);
});

test('admin: contrast, landmarks, heading order, keyboard skip link', async ({ page }) => {
	test.slow();
	await registerAdmin(page);
	await expectAccessible(page, [...ADMIN, ...ADMIN_MORE]);
	await page.goto('/admin/events');
	await hydrated(page);
	await page.keyboard.press('Tab');
	await expect(page.getByRole('link', { name: 'Skip to content' })).toBeFocused();
});

test('reduced motion: transitions and animations are switched off', async ({ page }) => {
	await page.emulateMedia({ reducedMotion: 'reduce' });
	await page.goto('/login');
	const button = page.getByRole('button', { name: 'Log in', exact: true });
	const duration = await button.evaluate((el) =>
		parseFloat(getComputedStyle(el).transitionDuration)
	);
	expect(duration).toBeLessThan(0.001);
});
