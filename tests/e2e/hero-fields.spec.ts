import { existsSync } from 'node:fs';
import { expect, test } from '@playwright/test';
import postgres from 'postgres';
import { heroFixtures } from './hero-fixtures';

if (!process.env.DATABASE_URL && existsSync('.env')) process.loadEnvFile('.env');
const sql = postgres(process.env.DATABASE_URL ?? '', { max: 1, onnotice: () => {} });
test.afterAll(() => sql.end());
/* Only sign-up counters: auth.spec.ts runs in parallel and checks the sign-in limit. */
test.beforeEach(async () => {
	await sql`delete from rate_limit where key ~ '^sign-up:ip:(127\.0\.0\.1|::1|::ffff:127\.0\.0\.1)$'`;
});

const { registerAs, title } = heroFixtures(sql);

test('a video link of another site is refused at the field', async ({ page }) => {
	await registerAs(page, 'editor');
	await page.goto('/admin/hero/new');
	await page.getByLabel('Type').selectOption('video');
	await page.getByLabel('Title (English)', { exact: true }).fill(title('bad-video'));
	await page.getByLabel('Video link').fill('https://vimeo.com/123');
	await page.getByRole('button', { name: 'Save' }).click();
	await expect(page).toHaveURL('/admin/hero/new');
	await expect(page.getByText('YouTube or Instagram link')).toBeVisible();
});

test('person search: only adults, only name and avatar; members get 404', async ({
	page,
	browser
}) => {
	await registerAs(page, 'editor');
	const tag = `Herop${crypto.randomUUID().slice(0, 8)}`;
	const adult = `e2e-hero-adult-${crypto.randomUUID()}@example.com`;
	const minor = `e2e-hero-minor-${crypto.randomUUID()}@example.com`;
	await sql`insert into users (email, name, first_name, last_name, birth_date) values
		(${adult}, ${`Adult ${tag}`}, 'Adult', ${tag}, '1990-01-01'),
		(${minor}, ${`Minor ${tag}`}, 'Minor', ${tag}, (current_date - interval '15 years')::date)`;
	const res = await page.request.get(`/admin/hero/persons?q=${tag}`);
	expect(res.status()).toBe(200);
	const found = await res.json();
	expect(found).toEqual([{ id: expect.any(String), name: `Adult ${tag}`, avatarKey: null }]);

	const member = await (await browser.newContext()).newPage();
	await registerAs(member, 'member');
	expect((await member.request.get(`/admin/hero/persons?q=${tag}`)).status()).toBe(404);
});
