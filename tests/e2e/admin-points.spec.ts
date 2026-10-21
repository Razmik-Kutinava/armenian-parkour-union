import { existsSync } from 'node:fs';
import { expect, test, type Page } from '@playwright/test';
import postgres from 'postgres';

/* docs/05 section 12, docs/03 section 6.3: an admin adds points by hand with a comment and sees the
 * balance before and after, finds the entry in the ledger, reverses it once, exports the ledger;
 * the balance never goes below zero; a moderator only reads. */

if (!process.env.DATABASE_URL && existsSync('.env')) process.loadEnvFile('.env');
const sql = postgres(process.env.DATABASE_URL ?? '', { max: 1, onnotice: () => {} });
const ORIGIN = { origin: 'http://localhost:4173' };

test.afterAll(() => sql.end());
test.beforeEach(async () => {
	await sql`delete from rate_limit where key ~ '^sign-up:ip:(127\.0\.0\.1|::1|::ffff:127\.0\.0\.1)$'`;
});

async function registerAs(page: Page, role: 'moderator' | 'admin') {
	const email = `e2e-points-${role}-${crypto.randomUUID()}@example.com`;
	await page.goto('/register');
	await page.getByLabel('Email').fill(email);
	await page.getByLabel('Password').fill('parkour-pass-1');
	await page.getByLabel('First name').fill('Points');
	await page.getByLabel('Last name').fill(role);
	await page.getByLabel('Date of birth').fill('1990-01-01');
	await page.getByLabel(/privacy policy/).check();
	await page.getByRole('button', { name: 'Create account' }).click();
	await expect(page).toHaveURL('/');
	await sql`update users set role = ${role} where email = ${email}`;
}

async function insertMember() {
	const email = `e2e-points-member-${crypto.randomUUID()}@example.com`;
	const [row] = await sql`
		insert into users (email, name, first_name, last_name, birth_date)
		values (${email}, 'Points Member', 'Points', 'Member', '1990-01-01') returning id`;
	return { id: row.id as string, email };
}

const balanceOf = async (id: string) =>
	(await sql`select points_balance from users where id = ${id}`)[0].points_balance as number;

test('admin: adjustment with balance before and after, ledger, one reversal, export', async ({
	page
}) => {
	await registerAs(page, 'admin');
	const member = await insertMember();
	const comment = `Jam help ${crypto.randomUUID().slice(0, 8)}`;

	await page.goto(`/admin/points/new?email=${encodeURIComponent(member.email)}`);
	await expect(page.locator('main')).toContainText('Points Member');
	await expect(page.locator('main')).toContainText('Current balance: 0');
	await page.getByLabel('Points (+ or −)').fill('50');
	await page.getByLabel('Comment').fill(comment);
	const dialog = page.getByRole('dialog');
	await expect(async () => {
		await page.getByRole('button', { name: 'Continue' }).click();
		await expect(dialog).toBeVisible({ timeout: 1_000 });
	}).toPass({ timeout: 15_000 });
	await expect(dialog).toContainText('0 → 50');
	await dialog.getByRole('button', { name: 'Save' }).click();
	await expect(page.getByRole('status')).toContainText('0 → 50');
	expect(await balanceOf(member.id)).toBe(50);

	const tooMuch = await page.request.post('/admin/points/new', {
		form: { userId: member.id, delta: '-51', comment: 'Too much' },
		headers: ORIGIN
	});
	expect(tooMuch.status()).toBe(400);
	expect(await balanceOf(member.id)).toBe(50);

	const list = `/admin/points?q=${encodeURIComponent(member.email)}`;
	await page.goto(list);
	const row = page.getByRole('row', { name: new RegExp(comment) });
	await expect(row).toContainText('+50');
	await expect(row).toContainText('Manual');
	const [entry] = await sql`select id from points_ledger where comment = ${comment}`;

	await expect(async () => {
		await row.getByRole('button', { name: 'Reverse' }).click();
		await expect(dialog).toBeVisible({ timeout: 1_000 });
	}).toPass({ timeout: 15_000 });
	await dialog.getByLabel(/Comment/).fill('Entered by mistake');
	await dialog.getByRole('button', { name: 'Reverse the entry' }).click();
	await expect(page.getByRole('status')).toContainText('The entry has been reversed');
	expect(await balanceOf(member.id)).toBe(0);
	await expect(row).toContainText('Reversed');
	await expect(row.getByRole('button', { name: 'Reverse' })).toHaveCount(0);

	const again = await page.request.post('/admin/points?/reverse', {
		form: { entryId: entry.id, comment: 'Again' },
		headers: ORIGIN
	});
	expect(again.status()).toBe(400);
	expect(await sql`select 1 from points_ledger where reversal_of_id = ${entry.id}`).toHaveLength(1);

	const csv = await page.request.get(`/admin/points/export?q=${encodeURIComponent(member.email)}`);
	expect(csv.headers()['content-type']).toContain('text/csv');
	const text = await csv.text();
	expect(text).toContain(comment);
	expect(text).toContain('Entered by mistake');
});

test('moderator: reads the ledger, no adjustment, reversal or export', async ({ page }) => {
	await registerAs(page, 'moderator');
	const member = await insertMember();
	const comment = `Moderator view ${crypto.randomUUID().slice(0, 8)}`;
	const [entry] = await sql`
		insert into points_ledger (user_id, delta, reason, comment)
		values (${member.id}, 15, 'manual', ${comment}) returning id`;
	await sql`update users set points_balance = 15 where id = ${member.id}`;

	await page.goto(`/admin/points?q=${encodeURIComponent(member.email)}`);
	await expect(page.getByRole('row', { name: new RegExp(comment) })).toBeVisible();
	await expect(page.getByRole('button', { name: 'Reverse' })).toHaveCount(0);
	await expect(page.getByRole('link', { name: 'Adjust points' })).toHaveCount(0);
	await expect(page.getByRole('link', { name: /CSV/ })).toHaveCount(0);

	expect((await page.request.get('/admin/points/new')).status()).toBe(403);
	expect((await page.request.get('/admin/points/export')).status()).toBe(403);
	const reverse = await page.request.post('/admin/points?/reverse', {
		form: { entryId: entry.id, comment: 'Not mine' },
		headers: ORIGIN
	});
	expect(reverse.status()).toBe(403);
	expect(await balanceOf(member.id)).toBe(15);
});
