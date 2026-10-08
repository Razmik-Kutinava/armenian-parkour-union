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

async function registerEditor(page: Page) {
	const email = `e2e-news-${crypto.randomUUID()}@example.com`;
	await page.goto('/register');
	await page.getByLabel('Email').fill(email);
	await page.getByLabel('Password').fill('parkour-pass-1');
	await page.getByLabel('First name').fill('News');
	await page.getByLabel('Last name').fill('Editor');
	await page.getByLabel('Date of birth').fill('1990-01-01');
	await page.getByLabel(/privacy policy/).check();
	await page.getByRole('button', { name: 'Create account' }).click();
	await expect(page).toHaveURL('/');
	await sql`update users set role = 'editor' where email = ${email}`;
}

const meta = (page: Page, key: string) =>
	page.locator(`meta[property="${key}"], meta[name="${key}"]`).first().getAttribute('content');

test('editor writes a draft, previews, publishes; guest reads it with Open Graph', async ({
	page,
	browser
}) => {
	test.setTimeout(120_000);
	await registerEditor(page);
	const guest = await (await browser.newContext()).newPage();
	const slug = `e2e-news-${crypto.randomUUID().slice(0, 8)}`;
	const tag = `e2e-${crypto.randomUUID().slice(0, 6)}`;

	await page.goto('/admin/news');
	await page.getByRole('link', { name: 'New post' }).click();
	await expect(page).toHaveURL('/admin/news/new');
	await page.getByLabel('Address').fill(slug);
	await page.getByLabel('Title (English)').fill('Summer jam');
	await page.getByLabel('Excerpt (English)').fill('Jam in Yerevan on Saturday');
	await page.getByRole('textbox', { name: 'Text (English)' }).click();
	await page.keyboard.type('Bring water and good shoes');
	await page.getByLabel('Tags').fill(`Jam, ${tag}`);
	await page.getByRole('button', { name: 'Save' }).click();
	await expect(page).toHaveURL(/\/admin\/news\/[0-9a-f-]{36}$/);
	const [row] = await sql`select id, status, tags, author_id from posts where slug = ${slug}`;
	expect(row).toMatchObject({ status: 'draft', tags: ['jam', tag] });
	expect(row.author_id).not.toBeNull();

	expect((await guest.goto(`/news/${slug}`))?.status()).toBe(404);
	await guest.goto('/news');
	await expect(guest.getByRole('link', { name: 'Summer jam' })).toHaveCount(0);

	const preview = await page.request.get(`/admin/news/${row.id}/preview`);
	expect(preview.status()).toBe(200);
	expect(await preview.text()).toContain('Bring water and good shoes');
	expect(
		(await guest.request.get(`/admin/news/${row.id}/preview`, { maxRedirects: 0 })).status()
	).toBe(303);

	await page.getByRole('button', { name: 'Publish' }).click();
	await expect(page.getByText('Published', { exact: true }).first()).toBeVisible();
	expect((await sql`select status from posts where id = ${row.id}`)[0].status).toBe('published');

	expect((await guest.goto(`/news?tag=${tag}`))?.status()).toBe(200);
	await guest.getByRole('link', { name: 'Summer jam' }).click();
	await expect(guest).toHaveURL(`/news/${slug}`);
	await expect(guest.getByRole('heading', { level: 1, name: 'Summer jam' })).toBeVisible();
	await expect(guest.getByText('Bring water and good shoes')).toBeVisible();
	expect(await meta(guest, 'og:title')).toBe('Summer jam');
	expect(await meta(guest, 'og:description')).toBe('Jam in Yerevan on Saturday');
	expect(await meta(guest, 'og:type')).toBe('article');
	expect(await meta(guest, 'og:url')).toMatch(new RegExp(`/news/${slug}$`));
	expect(await meta(guest, 'description')).toBe('Jam in Yerevan on Saturday');
	expect(await guest.locator('link[rel="canonical"]').getAttribute('href')).toMatch(
		new RegExp(`/news/${slug}$`)
	);
	const ld = JSON.parse((await guest.locator('script[type="application/ld+json"]').textContent())!);
	expect(ld).toMatchObject({ '@type': 'Article', headline: 'Summer jam' });

	await page.getByLabel('Publication date').fill('2099-01-01T10:00');
	await page.getByRole('button', { name: 'Save' }).click();
	await expect(page.getByText('Saved')).toBeVisible();
	expect((await guest.goto(`/news/${slug}`))?.status()).toBe(404);

	await page.getByRole('button', { name: 'Duplicate' }).click();
	await expect(page).toHaveURL(/\/admin\/news\/[0-9a-f-]{36}$/);
	await expect(page.getByLabel('Address')).toHaveValue(`${slug}-copy`);
	const [copy] = await sql`select status, published_at from posts where slug = ${`${slug}-copy`}`;
	expect(copy).toEqual({ status: 'draft', published_at: null });

	await page.goto(`/admin/news/${row.id}`);
	await page.getByRole('button', { name: 'Delete' }).click();
	await page.getByRole('dialog').getByRole('button', { name: 'Delete' }).click();
	await expect(page).toHaveURL('/admin/news');
	expect(
		(await sql`select deleted_at from posts where id = ${row.id}`)[0].deleted_at
	).not.toBeNull();
});

test('the news list is in the site menu and answers in every language', async ({ page }) => {
	for (const path of ['/news', '/hy/news', '/ru/news']) {
		expect((await page.goto(path))?.status(), path).toBe(200);
	}
	await page.goto('/');
	await expect(
		page.getByRole('navigation').getByRole('link', { name: 'News' }).first()
	).toHaveAttribute('href', '/news');
});
