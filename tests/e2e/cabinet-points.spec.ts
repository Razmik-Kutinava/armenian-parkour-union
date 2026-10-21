import { existsSync } from 'node:fs';
import { expect, test, type Page } from '@playwright/test';
import postgres from 'postgres';

/* docs/06 sections 5.1, 5.6: balance, own ledger with a filter, "how to earn"; the overview links
 * to the ledger. The ledger is append-only: these entries stay in parkour_dev with the e2e user. */

if (!process.env.DATABASE_URL && existsSync('.env')) process.loadEnvFile('.env');
const sql = postgres(process.env.DATABASE_URL ?? '', { max: 1, onnotice: () => {} });
test.afterAll(() => sql.end());

test.beforeEach(async () => {
	await sql`delete from rate_limit where key ~ '^sign-up:ip:(127\.0\.0\.1|::1|::ffff:127\.0\.0\.1)$'`;
});

async function register(page: Page): Promise<string> {
	const email = `e2e-points-${crypto.randomUUID()}@example.com`;
	await page.goto('/register');
	await page.getByLabel('Email').fill(email);
	await page.getByLabel('Password').fill('parkour-pass-1');
	await page.getByLabel('First name').fill('Points');
	await page.getByLabel('Last name').fill('Owner');
	await page.getByLabel('Date of birth').fill('1990-01-01');
	await page.getByLabel(/privacy policy/).check();
	await page.getByRole('button', { name: 'Create account' }).click();
	await expect(page).toHaveURL('/');
	const [user] = await sql`select id from users where email = ${email}`;
	return user.id as string;
}

test('guest: the points page sends to log in and back', async ({ page }) => {
	await page.goto('/cabinet/points');
	await expect(page).toHaveURL('/login?returnTo=%2Fcabinet%2Fpoints');
});

test('member: balance, own ledger, reversal marks, filter by reason, how to earn', async ({
	page
}) => {
	const userId = await register(page);
	const [award] = await sql`insert into points_ledger (user_id, delta, reason, source_type,
		source_id, created_at) values (${userId}, 20, 'event_participation', 'event_registration',
		${crypto.randomUUID()}, now() - interval '2 days') returning id`;
	await sql`insert into points_ledger (user_id, delta, reason, comment, created_at)
		values (${userId}, 15, 'manual', 'Volunteering at the jam', now() - interval '1 day')`;
	await sql`insert into points_ledger (user_id, delta, reason, comment, reversal_of_id)
		values (${userId}, -20, 'reversal', 'Did not come', ${award.id})`;
	await sql`update users set points_balance = 15 where id = ${userId}`;
	// CI only migrates the e2e database; parkour_dev already has the seeded rule.
	await sql`insert into points_rules (code, title, points, is_active)
		values ('video_approved', ${sql.json({ en: 'Approved video' })}, 10, true)
		on conflict (code) do nothing`;

	await page.goto('/cabinet');
	const main = page.locator('main');
	await main.getByRole('link', { name: 'Points history' }).click();
	await expect(page).toHaveURL('/cabinet/points');
	const nav = page.getByRole('navigation', { name: 'Cabinet' });
	await expect(nav.getByRole('link', { name: 'Points' })).toHaveAttribute('aria-current', 'page');

	await expect(main.getByRole('region', { name: 'Balance' })).toContainText('15');
	const ledger = main.getByRole('table');
	await expect(ledger.getByRole('row')).toHaveCount(4);
	await expect(ledger.getByText('Volunteering at the jam')).toBeVisible();
	await expect(ledger.getByText('Reversed', { exact: true })).toBeVisible();
	await expect(ledger.getByText(/Reversal of the entry of/)).toBeVisible();
	await expect(ledger.getByText('Federation')).toBeVisible();

	await main.getByLabel('Reason').selectOption('manual');
	await main.getByRole('button', { name: 'Show' }).click();
	await expect(page).toHaveURL(/\/cabinet\/points\?.*reason=manual/);
	await expect(ledger.getByRole('row')).toHaveCount(2);

	const earn = main.getByRole('region', { name: 'How to earn points' });
	await expect(earn.getByRole('listitem').first()).toBeVisible();
});
