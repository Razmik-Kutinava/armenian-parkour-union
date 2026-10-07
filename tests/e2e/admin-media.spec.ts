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
	const email = `e2e-media-${crypto.randomUUID()}@example.com`;
	await page.goto('/register');
	await page.getByLabel('Email').fill(email);
	await page.getByLabel('Password').fill('parkour-pass-1');
	await page.getByLabel('First name').fill('Media');
	await page.getByLabel('Last name').fill('Editor');
	await page.getByLabel('Date of birth').fill('1990-01-01');
	await page.getByLabel(/privacy policy/).check();
	await page.getByRole('button', { name: 'Create account' }).click();
	await expect(page).toHaveURL('/');
	const [row] = await sql`update users set role = 'editor' where email = ${email} returning id`;
	return row.id as string;
}

async function insertFile(uploadedBy: string, name: string) {
	const key = `media/2026/10/${crypto.randomUUID()}.png`;
	const [row] = await sql`
		insert into media (key, original_name, mime, size_bytes, uploaded_by)
		values (${key}, ${name}, 'image/png', 2048, ${uploadedBy}) returning id`;
	return { id: row.id as string, key };
}

test('editor finds a file, sets alt, cannot delete it while used, deletes it after', async ({
	page
}) => {
	test.setTimeout(90_000);
	const editorId = await registerEditor(page);
	const tag = crypto.randomUUID().slice(0, 8);
	const file = await insertFile(editorId, `${tag}-jump.png`);
	await sql`update users set avatar_key = ${file.key} where id = ${editorId}`;

	await page.goto(`/admin/media?q=${tag}`);
	await page.getByRole('link', { name: `${tag}-jump.png` }).click();
	await expect(page).toHaveURL(`/admin/media/${file.id}`);

	await page.getByLabel('Alt text (English)').fill('Wall run');
	await page.getByRole('button', { name: 'Save' }).click();
	await expect(page.getByText('Saved')).toBeVisible();
	expect((await sql`select alt from media where id = ${file.id}`)[0].alt).toEqual({
		en: 'Wall run'
	});

	await expect(page.getByText('User avatar')).toBeVisible();
	await expect(page.getByRole('button', { name: 'Delete' })).toBeDisabled();
	const forced = await page.request.post(`/admin/media/${file.id}?/delete`, {
		form: {},
		headers: { origin: 'http://localhost:4173' }
	});
	expect(forced.status()).toBe(400);
	expect((await sql`select deleted_at from media where id = ${file.id}`)[0].deleted_at).toBeNull();

	await sql`update users set avatar_key = null where id = ${editorId}`;
	await page.reload();
	await page.getByRole('button', { name: 'Delete' }).click();
	await page.getByRole('dialog').getByRole('button', { name: 'Delete' }).click();
	await expect(page).toHaveURL('/admin/media');
	await page.goto(`/admin/media?q=${tag}`);
	await expect(page.getByRole('link', { name: `${tag}-jump.png` })).toHaveCount(0);
});

test('the uploader refuses SVG and files over 10 MB before sending anything', async ({ page }) => {
	await registerEditor(page);
	await page.goto('/admin/media');
	const signs: string[] = [];
	page.on('request', (r) => r.url().includes('?/sign') && signs.push(r.url()));

	await page.getByLabel('Choose files').setInputFiles([
		{ name: 'logo.svg', mimeType: 'image/svg+xml', buffer: Buffer.from('<svg/>') },
		{ name: 'huge.png', mimeType: 'image/png', buffer: Buffer.alloc(10 * 1024 * 1024 + 1) }
	]);
	await expect(page.getByText('logo.svg')).toBeVisible();
	await expect(page.getByText('This file type is not allowed')).toBeVisible();
	await expect(page.getByText('The file is larger than 10 MB')).toBeVisible();
	expect(signs).toHaveLength(0);
});
