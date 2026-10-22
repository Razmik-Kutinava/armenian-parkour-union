import { existsSync } from 'node:fs';
import { expect, test, type Page } from '@playwright/test';
import postgres from 'postgres';
import { hydrated } from './hydrated';

/* docs/06 section 5.2 "photo", decisions.md 2026-10-22. Upload itself goes to R2 (not in CI):
 * here — the checks that need no bucket. */

if (!process.env.DATABASE_URL && existsSync('.env')) process.loadEnvFile('.env');
const sql = postgres(process.env.DATABASE_URL ?? '', { max: 1, onnotice: () => {} });
test.afterAll(() => sql.end());

test.beforeEach(async () => {
	await sql`delete from rate_limit where key ~ '^sign-up:ip:(127\.0\.0\.1|::1|::ffff:127\.0\.0\.1)$'`;
});

async function register(page: Page): Promise<string> {
	const email = `e2e-avatar-${crypto.randomUUID()}@example.com`;
	await page.goto('/register');
	await page.getByLabel('Email').fill(email);
	await page.getByLabel('Password').fill('parkour-pass-1');
	await page.getByLabel('First name').fill('Avatar');
	await page.getByLabel('Last name').fill('Owner');
	await page.getByLabel('Date of birth').fill('1990-01-01');
	await page.getByLabel(/privacy policy/).check();
	await page.getByRole('button', { name: 'Create account' }).click();
	await expect(page).toHaveURL('/cabinet');
	const [user] = await sql`select id from users where email = ${email}`;
	return user.id as string;
}

const avatarOf = async (id: string) =>
	(await sql`select avatar_key from users where id = ${id}`)[0].avatar_key as string | null;

test('photo: a non-image is refused at once; "Remove photo" clears it', async ({ page }) => {
	const id = await register(page);
	await page.goto('/cabinet/profile');
	await hydrated(page);
	await expect(page.getByRole('heading', { name: 'Photo' })).toBeVisible();
	await page.getByLabel('Upload a photo').setInputFiles({
		name: 'cv.pdf',
		mimeType: 'application/pdf',
		buffer: Buffer.from('%PDF-1.4')
	});
	await expect(page.getByText('Choose a JPEG, PNG or WebP image.')).toBeVisible();
	expect(await avatarOf(id)).toBeNull();

	await sql`update users set avatar_key = ${`avatars/${id}/${crypto.randomUUID()}.png`}
		where id = ${id}`;
	await page.reload();
	await hydrated(page);
	await page.getByRole('button', { name: 'Remove photo' }).click();
	await expect(page.getByText('Photo removed.')).toBeVisible();
	await expect(page.getByRole('button', { name: 'Remove photo' })).toHaveCount(0);
	expect(await avatarOf(id)).toBeNull();
});

test('photo: another member`s file cannot be set as one`s own avatar', async ({ page }) => {
	const [victim] = await sql`select id from users where deleted_at is null limit 1`;
	const id = await register(page);
	await page.goto('/cabinet/profile');
	const status = await page.evaluate(async (key) => {
		const body = new FormData();
		body.set('key', key);
		const res = await fetch('/cabinet/profile?/avatarComplete', {
			method: 'POST',
			body,
			headers: { 'x-sveltekit-action': 'true' }
		});
		return (await res.json()).status as number;
	}, `avatars/${victim.id}/${crypto.randomUUID()}.png`);
	expect(status).toBe(400);
	expect(await avatarOf(id)).toBeNull();
});
