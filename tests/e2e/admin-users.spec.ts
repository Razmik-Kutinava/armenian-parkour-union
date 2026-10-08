import { existsSync } from 'node:fs';
import { expect, test, type Browser, type Page } from '@playwright/test';
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
	const email = `e2e-users-${role}-${crypto.randomUUID()}@example.com`;
	await page.goto('/register');
	await page.getByLabel('Email').fill(email);
	await page.getByLabel('Password').fill('parkour-pass-1');
	await page.getByLabel('First name').fill('Users');
	await page.getByLabel('Last name').fill(lastName);
	await page.getByLabel('Date of birth').fill('1990-01-01');
	await page.getByLabel(/privacy policy/).check();
	await page.getByRole('button', { name: 'Create account' }).click();
	await expect(page).toHaveURL('/');
	await sql`update users set role = ${role} where email = ${email}`;
	const [row] = await sql`select id from users where email = ${email}`;
	return { email, id: row.id as string };
}

async function memberInOwnContext(browser: Browser, lastName: string) {
	const page = await (await browser.newContext()).newPage();
	return { page, ...(await registerAs(page, 'member', lastName)) };
}

test('admin creates a user; the user is in the list and in the audit log', async ({ page }) => {
	await registerAs(page, 'admin');
	await page.goto('/admin/users');
	await page.getByRole('link', { name: 'Create user' }).click();
	await expect(page).toHaveURL('/admin/users/new');
	const email = `e2e-created-${crypto.randomUUID()}@example.com`;
	const tag = crypto.randomUUID().slice(0, 8);
	await page.getByLabel('Email', { exact: true }).fill(email);
	await page.getByLabel('First name').fill('Created');
	await page.getByLabel('Last name').fill(tag);
	await page.getByLabel('Date of birth').fill('1992-02-02');
	await page.getByRole('button', { name: 'Create user' }).click();
	await expect(page.getByRole('heading', { name: `Created ${tag}` })).toBeVisible();

	await page.goto(`/admin/users?q=${tag}`);
	await expect(page.getByRole('link', { name: `Created ${tag}` })).toBeVisible();
	const [row] = await sql`
		select a.action from audit_log a join users u on u.id = a.entity_id
		where u.email = ${email}`;
	expect(row.action).toBe('user.create');
});

test('admin changes a role; the card history shows it', async ({ page, browser }) => {
	await registerAs(page, 'admin');
	const member = await memberInOwnContext(browser, `role-${crypto.randomUUID().slice(0, 8)}`);
	await page.goto(`/admin/users/${member.id}`);
	/* A choice made before hydration is lost and the button stays disabled: choose until it counts. */
	await expect(async () => {
		await page.getByLabel('Role', { exact: true }).selectOption('editor');
		await expect(page.getByRole('button', { name: 'Change role' })).toBeEnabled({ timeout: 1000 });
	}).toPass();
	await page.getByRole('button', { name: 'Change role' }).click();
	await page.getByRole('dialog').getByRole('button', { name: 'Change role' }).click();
	await expect(page.getByText('Saved.')).toBeVisible();
	const [row] = await sql`select role from users where id = ${member.id}`;
	expect(row.role).toBe('editor');
	await page.getByRole('link', { name: 'History' }).click();
	await expect(page.getByRole('table')).toContainText('user.role_change');
});

test('blocked user loses access at once, sessions are gone', async ({ page, browser }) => {
	await registerAs(page, 'admin');
	const member = await memberInOwnContext(browser, `block-${crypto.randomUUID().slice(0, 8)}`);
	await page.goto(`/admin/users/${member.id}`);
	const dialog = page.getByRole('dialog');
	/* A click before hydration does not open the dialog: click until it opens. */
	await expect(async () => {
		await page.getByRole('button', { name: 'Block' }).click();
		await expect(dialog).toBeVisible({ timeout: 1000 });
	}).toPass();
	await dialog.getByLabel('Comment (required)').fill('Spam in comments');
	await dialog.getByRole('button', { name: 'Block' }).click();
	await expect(page.getByText('Saved.')).toBeVisible();

	const sessions = await sql`select 1 from session where user_id = ${member.id}`;
	expect(sessions).toHaveLength(0);
	await member.page.goto('/');
	await expect(member.page.getByRole('link', { name: 'Log in' })).toBeVisible();
});

test('admin cannot change their own role or block themselves', async ({ page }) => {
	const self = await registerAs(page, 'admin');
	const post = (action: string, form: Record<string, string>) =>
		page.request.post(`/admin/users/${self.id}?/${action}`, { form, headers: ORIGIN });
	await post('role', { role: 'member' });
	await post('block', { comment: 'x' });
	const [row] = await sql`select role, status from users where id = ${self.id}`;
	expect(row).toMatchObject({ role: 'admin', status: 'active' });
});

test('moderator: list without emails, staff cards 404, no role action', async ({
	page,
	browser
}) => {
	await registerAs(page, 'moderator');
	const tag = `mod-${crypto.randomUUID().slice(0, 8)}`;
	const member = await memberInOwnContext(browser, tag);
	await page.goto(`/admin/users?q=${tag}`);
	await expect(page.getByRole('link', { name: `Users ${tag}` })).toBeVisible();
	await expect(page.getByText(member.email)).toHaveCount(0);

	const adminRow = (await sql`select id from users where role = 'admin' limit 1`)[0];
	expect((await page.goto(`/admin/users/${adminRow.id}`))?.status()).toBe(404);
	const res = await page.request.post(`/admin/users/${member.id}?/role`, {
		form: { role: 'editor' },
		headers: ORIGIN
	});
	expect(res.status()).toBe(403);
	const [row] = await sql`select role from users where id = ${member.id}`;
	expect(row.role).toBe('member');
});

test('editor gets 403 on users and roles, pages and actions', async ({ page }) => {
	await registerAs(page, 'editor');
	expect((await page.goto('/admin/users'))?.status()).toBe(403);
	expect((await page.goto('/admin/roles'))?.status()).toBe(403);
	const res = await page.request.post('/admin/roles?/grant', {
		form: { userId: crypto.randomUUID(), role: 'admin' },
		headers: ORIGIN
	});
	expect(res.status()).toBe(403);
});

test('admins and roles: grant a role through search, then take it back', async ({
	page,
	browser
}) => {
	await registerAs(page, 'admin');
	const tag = `grant-${crypto.randomUUID().slice(0, 8)}`;
	const member = await memberInOwnContext(browser, tag);
	await page.goto('/admin/roles');
	await page.getByLabel('Find a member').fill(tag);
	await page.getByRole('button', { name: 'Find' }).click();
	const found = page.getByRole('listitem').filter({ hasText: `Users ${tag}` });
	await found.getByLabel('Role', { exact: true }).selectOption('moderator');
	await found.getByRole('button', { name: 'Grant role' }).click();
	await page.getByRole('dialog').getByRole('button', { name: 'Grant role' }).click();
	await expect(page.getByRole('row').filter({ hasText: `Users ${tag}` })).toContainText(
		'Moderator'
	);

	await page
		.getByRole('row')
		.filter({ hasText: `Users ${tag}` })
		.getByRole('button', { name: 'Take role' })
		.click();
	await page.getByRole('dialog').getByRole('button', { name: 'Take role' }).click();
	await expect(page.getByRole('row').filter({ hasText: `Users ${tag}` })).toHaveCount(0);
	const [row] = await sql`select role from users where id = ${member.id}`;
	expect(row.role).toBe('member');
});
