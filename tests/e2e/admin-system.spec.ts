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

type Role = 'member' | 'editor' | 'moderator' | 'admin';
const ORIGIN = { origin: 'http://localhost:4173' };

async function registerAs(page: Page, role: Role, lastName: string = role) {
	const email = `e2e-system-${role}-${crypto.randomUUID()}@example.com`;
	await page.goto('/register');
	await page.getByLabel('Email').fill(email);
	await page.getByLabel('Password').fill('parkour-pass-1');
	await page.getByLabel('First name').fill('System');
	await page.getByLabel('Last name').fill(lastName);
	await page.getByLabel('Date of birth').fill('1990-01-01');
	await page.getByLabel(/privacy policy/).check();
	await page.getByRole('button', { name: 'Create account' }).click();
	await expect(page).toHaveURL('/');
	await sql`update users set role = ${role} where email = ${email}`;
	const [row] = await sql`select id from users where email = ${email}`;
	return { email, id: row.id as string };
}

for (const role of ['editor', 'moderator'] as const) {
	test(`${role} gets 403 on the audit log, settings and export`, async ({ page }) => {
		await registerAs(page, role);
		for (const path of ['/admin/audit', '/admin/settings', '/admin/audit/export']) {
			expect((await page.goto(path))?.status(), path).toBe(403);
		}
		const post = await page.request.post('/admin/settings', {
			form: { 'site_name.en': 'Hacked', 'seo_description.en': 'x' },
			headers: ORIGIN
		});
		expect(post.status()).toBe(403);
	});
}

test('audit log: filter by author, open an entry, export CSV', async ({ page }) => {
	const tag = `audit-${crypto.randomUUID().slice(0, 8)}`;
	const admin = await registerAs(page, 'admin', tag);
	const [entry] = await sql`
		insert into audit_log (actor_id, action, entity_type, before, after, ip)
		values (${admin.id}, 'user.role_change', 'user', ${sql.json({ role: 'member' })},
			${sql.json({ role: 'editor' })}, '203.0.113.5')
		returning id`;

	await page.goto(`/admin/audit?q=${tag}`);
	const row = page.getByRole('row').filter({ hasText: 'user.role_change' });
	await expect(row).toContainText(`System ${tag}`);
	await expect(row).toContainText('203.0.113.5');
	await row.getByRole('link', { name: 'Open' }).click();
	await expect(page).toHaveURL(`/admin/audit/${entry.id}`);
	await expect(page.getByRole('region', { name: 'Before' })).toContainText('member');
	await expect(page.getByRole('region', { name: 'After' })).toContainText('editor');

	const csv = await page.request.get(`/admin/audit/export?q=${tag}`);
	expect(csv.status()).toBe(200);
	expect(csv.headers()['content-type']).toContain('text/csv');
	const text = await csv.text();
	expect(text.split('\r\n')[0]).toContain('action');
	expect(text).toContain('user.role_change');
});

test('settings: saved, logged with before and after, shown in the site footer', async ({
	page
}) => {
	const admin = await registerAs(page, 'admin');
	const phone = `+374 10 ${String(Math.floor(Math.random() * 1e6)).padStart(6, '0')}`;
	await page.goto('/admin/settings');
	await page.getByLabel('Federation name (English)').fill('Armenian Parkour Union');
	await page.getByLabel('Description for search engines (English)').fill('Parkour in Armenia');
	await page.getByLabel('Phone', { exact: true }).fill(phone);
	await page.getByRole('button', { name: 'Save' }).click();
	await expect(page.getByText('Saved.')).toBeVisible();

	const [log] = await sql`
		select before, after from audit_log
		where actor_id = ${admin.id} and action = 'settings.update' and after ? 'contacts'`;
	expect(log.after.contacts.phone).toBe(phone);

	await page.goto('/');
	await expect(page.getByRole('contentinfo')).toContainText(phone);
});

test('settings: footer links and the site name in the header come from the database', async ({
	page
}) => {
	await registerAs(page, 'admin');
	const tag = crypto.randomUUID().slice(0, 8);
	await page.goto('/admin/settings');
	/* Replace links left by earlier runs: the list holds at most 10. */
	await page
		.locator('input[name^="footer.links."]')
		.evaluateAll((els) => els.forEach((el) => ((el as HTMLInputElement).value = '')));
	await page
		.locator('input[name="site_name.ru"]')
		.evaluate((el) => ((el as HTMLInputElement).value = 'Союз паркура Армении'));
	await page.getByLabel('Federation name (English)').fill('Armenian Parkour Union');
	await page.getByLabel('Description for search engines (English)').fill('Parkour in Armenia');
	await page.locator('input[name="footer.links.0.label.en"]').fill(`Link ${tag}`);
	await page.locator('input[name="footer.links.0.url"]').fill(`/pages/e2e-${tag}`);
	await page.getByRole('button', { name: 'Save' }).click();
	await expect(page.getByText('Saved.')).toBeVisible();

	await page.goto('/ru');
	await expect(page.getByRole('banner').getByRole('link', { name: 'Союз паркура Армении' })).toBeVisible();
	await expect(
		page.getByRole('contentinfo').getByRole('link', { name: `Link ${tag}` })
	).toHaveAttribute('href', `/ru/pages/e2e-${tag}`);
});

test('settings: a footer link to another host is refused', async ({ page }) => {
	await registerAs(page, 'admin');
	await page.goto('/admin/settings');
	await page.locator('input[name="footer.links.0.label.en"]').fill('Evil');
	await page.locator('input[name="footer.links.0.url"]').fill('//evil.example');
	await page.getByRole('button', { name: 'Save' }).click();
	await expect(page.getByText('Enter a link starting with https:// or a site path /…')).toBeVisible();
});

test('settings: an http link is refused with a message at the field', async ({ page }) => {
	await registerAs(page, 'admin');
	await page.goto('/admin/settings');
	await page.getByLabel('Instagram').fill('http://instagram.com/apu');
	await page.getByRole('button', { name: 'Save' }).click();
	await expect(page.getByText('Enter a link starting with https://')).toBeVisible();
});
