import { existsSync } from 'node:fs';
import { expect, test, type Page } from '@playwright/test';
import postgres from 'postgres';
import { hydrated } from './hydrated';

/* docs/06 section 5.7, docs/04 section 7: adding a link needs an active membership; the platform
 * and duplicates are checked. Rows stay in parkour_dev with the e2e user (global setup soft-deletes
 * it). */

if (!process.env.DATABASE_URL && existsSync('.env')) process.loadEnvFile('.env');
const sql = postgres(process.env.DATABASE_URL ?? '', { max: 1, onnotice: () => {} });
test.afterAll(() => sql.end());

test.beforeEach(async () => {
	await sql`delete from rate_limit where key ~ '^sign-up:ip:(127\.0\.0\.1|::1|::ffff:127\.0\.0\.1)$'`;
});

async function register(page: Page) {
	const email = `e2e-videos-${crypto.randomUUID()}@example.com`;
	await page.goto('/register');
	await page.getByLabel('Email').fill(email);
	await page.getByLabel('Password').fill('parkour-pass-1');
	await page.getByLabel('First name').fill('Video');
	await page.getByLabel('Last name').fill('Owner');
	await page.getByLabel('Date of birth').fill('1990-01-01');
	await page.getByLabel(/privacy policy/).check();
	await page.getByRole('button', { name: 'Create account' }).click();
	await expect(page).toHaveURL('/cabinet');
	const [user] = await sql`select id from users where email = ${email}`;
	return user.id as string;
}

test('guest: the videos page sends to log in and back', async ({ page }) => {
	await page.goto('/cabinet/videos');
	await expect(page).toHaveURL('/login?returnTo=%2Fcabinet%2Fvideos');
});

test('member: no form without membership; adds a link, a duplicate and Vimeo are refused', async ({
	page
}) => {
	const id = await register(page);
	await page.goto('/cabinet');
	const nav = page.getByRole('navigation', { name: 'Cabinet' });
	await nav.getByRole('link', { name: 'Videos' }).click();
	await expect(page).toHaveURL('/cabinet/videos');
	const main = page.locator('main');
	await expect(main.getByText('Adding videos needs an active membership.')).toBeVisible();
	await expect(main.getByLabel('Link')).toHaveCount(0);

	await sql`insert into memberships (user_id, status, starts_at, ends_at)
		values (${id}, 'active', now() - interval '30 days', now() + interval '300 days')`;
	await page.reload();
	await hydrated(page);
	await expect(main.getByText('YouTube, Instagram; up to 5 videos a month.')).toBeVisible();

	await main.getByLabel('Link').fill('https://youtu.be/dQw4w9WgXcQ');
	await main.getByLabel('Title').fill('E2e wall run');
	await main.getByRole('button', { name: 'Add', exact: true }).click();
	await expect(main.getByText('Video added. A moderator will check it.')).toBeVisible();
	const list = main.getByRole('region', { name: 'Added videos' });
	const item = list.getByRole('listitem').filter({ hasText: 'E2e wall run' });
	await expect(item).toContainText('Under review');
	await expect(item.getByRole('link')).toHaveAttribute(
		'href',
		'https://www.youtube.com/watch?v=dQw4w9WgXcQ'
	);
	await expect(main.getByLabel('Link')).toHaveValue('');

	await main.getByLabel('Link').fill('https://www.youtube.com/watch?v=dQw4w9WgXcQ&t=3s');
	await main.getByLabel('Title').fill('E2e again');
	await main.getByRole('button', { name: 'Add', exact: true }).click();
	await expect(main.getByText('You have already added this video.')).toBeVisible();
	await expect(main.getByLabel('Title')).toHaveValue('E2e again');

	await main.getByLabel('Link').fill('https://vimeo.com/1');
	await main.getByRole('button', { name: 'Add', exact: true }).click();
	await expect(main.getByText(/This link is not accepted/)).toBeVisible();

	const rows = await sql`select status, platform from videos where user_id = ${id}`;
	expect(rows).toEqual([{ status: 'pending', platform: 'youtube' }]);
	const points = await sql`select id from points_ledger where user_id = ${id}`;
	expect(points).toHaveLength(0);
});
