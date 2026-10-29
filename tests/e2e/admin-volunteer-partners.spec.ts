import { existsSync } from 'node:fs';
import { expect, test } from '@playwright/test';
import postgres from 'postgres';
import { hydrated } from './hydrated';

/* docs/05 section 28 "Partners": an admin creates a published partner, adds a single-use perk with
 * a limit on the "Perks" tab, and sees the count in the list. */

if (!process.env.DATABASE_URL && existsSync('.env')) process.loadEnvFile('.env');
const sql = postgres(process.env.DATABASE_URL ?? '', { max: 1, onnotice: () => {} });
const TAG = crypto.randomUUID().slice(0, 8);

test.afterAll(async () => {
	const partners = sql`select id from volunteer_partners where name like ${`%${TAG}%`}`;
	await sql`delete from volunteer_perks where partner_id in (${partners})`;
	await sql`delete from volunteer_partners where name like ${`%${TAG}%`}`;
	await sql.end();
});
test.beforeEach(async () => {
	await sql`delete from rate_limit where key ~ '^sign-up:ip:(127\.0\.0\.1|::1|::ffff:127\.0\.0\.1)$'`;
});

test('partner and a single-use perk: created from the forms, counted in the list', async ({
	page
}) => {
	const email = `e2e-volunteer-${crypto.randomUUID()}@example.com`;
	await page.goto('/register');
	await page.getByLabel('Email').fill(email);
	await page.getByLabel('Password').fill('parkour-pass-1');
	await page.getByLabel('First name').fill('Volunteer');
	await page.getByLabel('Last name').fill('Admin');
	await page.getByLabel('Date of birth').fill('1990-01-01');
	await page.getByLabel(/privacy policy/).check();
	await page.getByRole('button', { name: 'Create account' }).click();
	await expect(page).toHaveURL('/cabinet');
	await sql`update users set role = 'admin' where email = ${email}`;

	const name = `Coffee ${TAG}`;
	await page.goto('/admin/volunteer/partners');
	await page.getByRole('link', { name: 'New partner' }).click();
	await hydrated(page);
	await page.getByLabel('Name', { exact: true }).fill(name);
	await page.getByLabel('Website').fill('https://coffee.am');
	await page.getByLabel('Status').selectOption('published');
	await page.getByRole('button', { name: 'Save' }).click();
	await expect(page).toHaveURL(/\/admin\/volunteer\/partners\/[0-9a-f-]{36}$/);
	await expect(page.getByRole('heading', { name })).toBeVisible();

	await page.getByRole('link', { name: 'Perks' }).click();
	await page.getByRole('link', { name: 'New perk' }).click();
	await hydrated(page);
	await page.getByLabel('Title (English)').fill('Free coffee');
	await page.getByLabel('Kind').selectOption('single');
	await page.getByLabel('Uses per card').fill('2');
	await page.getByLabel('Valid until').fill('2099-12-31');
	await page.getByLabel('Status').selectOption('published');
	await page.getByRole('button', { name: 'Save' }).click();
	await expect(page).toHaveURL(/\/perks\/[0-9a-f-]{36}$/);
	const [perk] = await sql`select p.kind, p.uses_limit, p.valid_until, p.status
		from volunteer_perks p join volunteer_partners v on v.id = p.partner_id
		where v.name = ${name}`;
	expect(perk).toMatchObject({ kind: 'single', uses_limit: 2, status: 'published' });

	await page.goto('/admin/volunteer/partners');
	const row = page.getByRole('row', { name: new RegExp(name) });
	await expect(row).toContainText('Published');
	await expect(row.getByRole('cell').nth(3)).toHaveText('1');
});
