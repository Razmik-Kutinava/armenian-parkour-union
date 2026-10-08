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

const ORIGIN = { origin: 'http://localhost:4173' };

async function registerEditor(page: Page) {
	const email = `e2e-pages-${crypto.randomUUID()}@example.com`;
	await page.goto('/register');
	await page.getByLabel('Email').fill(email);
	await page.getByLabel('Password').fill('parkour-pass-1');
	await page.getByLabel('First name').fill('Pages');
	await page.getByLabel('Last name').fill('Editor');
	await page.getByLabel('Date of birth').fill('1990-01-01');
	await page.getByLabel(/privacy policy/).check();
	await page.getByRole('button', { name: 'Create account' }).click();
	await expect(page).toHaveURL('/');
	await sql`update users set role = 'editor' where email = ${email}`;
}

test('editor creates and publishes a page, guest reads it, draft and deleted are gone', async ({
	page,
	browser
}) => {
	test.setTimeout(90_000);
	await registerEditor(page);
	const guest = await (await browser.newContext()).newPage();
	const slug = `e2e-page-${crypto.randomUUID().slice(0, 8)}`;

	await page.goto('/admin/pages');
	await page.getByRole('link', { name: 'New page' }).click();
	await expect(page).toHaveURL('/admin/pages/new');
	await page.getByLabel('Address').fill(slug);
	await page.getByLabel('Title (English)').fill('Summer camp');
	await page.getByRole('textbox', { name: 'Text (English)' }).click();
	await page.keyboard.type('Training every morning');
	await page.getByLabel('Status').selectOption('published');
	await page.getByRole('button', { name: 'Save' }).click();
	await expect(page).toHaveURL(/\/admin\/pages\/[0-9a-f-]{36}$/);
	const [row] = await sql`select id, body, status from pages where slug = ${slug}`;
	expect(row.status).toBe('published');
	expect(row.body.en).toContain('Training every morning');

	expect((await guest.goto(`/pages/${slug}`))?.status()).toBe(200);
	await expect(guest.getByRole('heading', { name: 'Summer camp' })).toBeVisible();
	await expect(guest.getByText('Training every morning')).toBeVisible();
	await guest.goto(`/ru/pages/${slug}`);
	await expect(guest.getByRole('heading', { name: 'Summer camp' })).toBeVisible();

	await page.getByLabel('Status').selectOption('draft');
	await page.getByRole('button', { name: 'Save' }).click();
	await expect(page.getByText('Saved')).toBeVisible();
	expect((await guest.goto(`/pages/${slug}`))?.status()).toBe(404);

	await page.getByRole('button', { name: 'Delete' }).click();
	await page.getByRole('dialog').getByRole('button', { name: 'Delete' }).click();
	await expect(page).toHaveURL('/admin/pages');
	await expect(page.getByRole('link', { name: 'Summer camp' })).toHaveCount(0);
	expect(
		(await sql`select deleted_at from pages where id = ${row.id}`)[0].deleted_at
	).not.toBeNull();
});

test('a system page keeps its address and cannot be deleted', async ({ page }) => {
	await registerEditor(page);
	await sql`
		insert into pages (slug, title, is_system) values ('rules', ${sql.json({ en: 'Rules' })}, true)
		on conflict (slug) do nothing`;
	const [before] = await sql`select * from pages where slug = 'rules'`;

	await page.goto(`/admin/pages/${before.id}`);
	await expect(page.getByLabel('Address')).toHaveAttribute('readonly');
	await expect(page.getByRole('button', { name: 'Delete' })).toHaveCount(0);

	const deleted = await page.request.post(`/admin/pages/${before.id}?/delete`, {
		form: {},
		headers: ORIGIN
	});
	expect(deleted.status()).toBe(400);
	const title = before.title as Record<string, string>;
	const body = before.body as Record<string, string>;
	const form: Record<string, string> = { slug: 'hijacked', status: before.status };
	for (const [lang, text] of Object.entries(title)) form[`title.${lang}`] = text;
	for (const [lang, html] of Object.entries(body)) form[`body.${lang}`] = html;
	const updated = await page.request.post(`/admin/pages/${before.id}?/update`, {
		form,
		headers: ORIGIN
	});
	expect(updated.ok()).toBe(true);
	const [after] = await sql`select slug, deleted_at from pages where id = ${before.id}`;
	expect(after).toEqual({ slug: 'rules', deleted_at: null });
});

test('"About us" lives at /federation: /pages/about redirects there', async ({ page }) => {
	for (const [from, to] of [
		['/pages/about', '/federation'],
		['/ru/pages/about', '/ru/federation']
	]) {
		const res = await page.request.get(from, { maxRedirects: 0 });
		expect(res.status(), from).toBe(301);
		expect(res.headers().location, from).toBe(to);
	}
});
