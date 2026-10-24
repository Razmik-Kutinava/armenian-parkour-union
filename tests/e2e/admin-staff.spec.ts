import { existsSync } from 'node:fs';
import { expect, test } from '@playwright/test';
import postgres from 'postgres';
import { permissionFixtures } from './admin-permissions-fixtures';
import { hydrated } from './hydrated';

/* docs/05 section 9: the admin finds a coach, fills the category, license and description and
 * makes the profile public — it shows on /federation/team; a profile without a live certificate
 * cannot be switched on (docs/03 section 5). The moderator only views. No member contacts. */

if (!process.env.DATABASE_URL && existsSync('.env')) process.loadEnvFile('.env');
const sql = postgres(process.env.DATABASE_URL ?? '', { max: 1, onnotice: () => {} });
test.afterAll(() => sql.end());
test.beforeEach(async () => {
	await sql`delete from rate_limit where key ~ '^sign-up:ip:(127\.0\.0\.1|::1|::ffff:127\.0\.0\.1)$'`;
});

async function coach(last: string) {
	const email = `e2e-staff-${crypto.randomUUID()}@example.com`;
	const [member] = await sql`
		insert into users (email, name, first_name, last_name, birth_date, email_verified)
		values (${email}, ${`Hayk ${last}`}, 'Hayk', ${last}, '1990-01-01', true) returning id`;
	const [cert] = await sql`
		insert into certificates (user_id, kind, number, public_token, issued_at, expires_at, issued_by)
		values (${member.id}, 'trainer', ${`E2E-${crypto.randomUUID()}`}, ${crypto.randomUUID()},
			now(), now() + interval '300 days', ${member.id}) returning number`;
	const [trainer] = await sql`
		insert into staff_profiles (user_id, kind) values (${member.id}, 'trainer') returning id`;
	const [judge] = await sql`
		insert into staff_profiles (user_id, kind, is_active) values (${member.id}, 'judge', false)
		returning id`;
	return { email, number: cert.number as string, trainer: trainer.id, judge: judge.id };
}

test('admin edits a coach profile and makes it public; no switching on without a certificate', async ({
	page
}) => {
	test.setTimeout(120_000);
	const last = `Staff${crypto.randomUUID().slice(0, 8)}`;
	const c = await coach(last);
	await permissionFixtures(sql).registerAs(page, 'admin');

	await page.goto(`/admin/staff?q=${last}&kind=trainer`);
	await expect(page.getByRole('link', { name: c.number })).toBeVisible();
	await page.getByRole('link', { name: `Hayk ${last}` }).click();
	await expect(page).toHaveURL(new RegExp(`/admin/staff/${c.trainer}$`));
	await hydrated(page);
	await page.getByLabel('Category').fill('National coach');
	await page.getByLabel('License number').fill('LIC-77');
	await page.getByLabel('Description (English)').fill('Coach of the national team.');
	await page.getByLabel('Show publicly').check();
	await page.getByRole('button', { name: 'Save' }).click();
	await expect(page.getByRole('status')).toContainText('Saved');
	const [saved] = await sql`select category, license_number, bio, is_public, is_active
		from staff_profiles where id = ${c.trainer}`;
	expect(saved).toEqual({
		category: 'National coach',
		license_number: 'LIC-77',
		bio: { en: 'Coach of the national team.' },
		is_public: true,
		is_active: true
	});
	expect(await page.content()).not.toContain(c.email);

	await page.goto('/federation/team');
	await expect(page.getByText(`Hayk ${last}`)).toBeVisible();

	await page.goto(`/admin/staff/${c.judge}`);
	await hydrated(page);
	await page.getByLabel('Active').check();
	await page.getByRole('button', { name: 'Save' }).click();
	await expect(page.getByText('No valid certificate of this kind')).toBeVisible();
	const [judge] = await sql`select is_active from staff_profiles where id = ${c.judge}`;
	expect(judge.is_active).toBe(false);
});

test('moderator sees the list and the card, without the form', async ({ page }) => {
	const last = `Staff${crypto.randomUUID().slice(0, 8)}`;
	const c = await coach(last);
	await permissionFixtures(sql).registerAs(page, 'moderator');

	await page.goto(`/admin/staff?q=${last}`);
	await expect(page.getByRole('link', { name: `Hayk ${last}` })).toHaveCount(2);
	await page.goto(`/admin/staff/${c.trainer}`);
	await expect(page.getByRole('heading', { level: 1 })).toContainText(`Hayk ${last}`);
	await expect(page.getByRole('button', { name: 'Save' })).toHaveCount(0);
	expect(await page.content()).not.toContain(c.email);
});
