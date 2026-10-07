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

async function registerAs(page: Page, role: Role) {
	const email = `e2e-block-${role}-${crypto.randomUUID()}@example.com`;
	await page.goto('/register');
	await page.getByLabel('Email').fill(email);
	await page.getByLabel('Password').fill('parkour-pass-1');
	await page.getByLabel('First name').fill('Block');
	await page.getByLabel('Last name').fill(role);
	await page.getByLabel('Date of birth').fill('1990-01-01');
	await page.getByLabel(/privacy policy/).check();
	await page.getByRole('button', { name: 'Create account' }).click();
	await expect(page).toHaveURL('/');
	await sql`update users set role = ${role} where email = ${email}`;
	const [row] = await sql`select id from users where email = ${email}`;
	return row.id as string;
}

const toLogin = /^\/login\?returnTo=/;
const location = (res: { headers(): Record<string, string> }) => res.headers()['location'] ?? '';

test('admin blocked by another admin loses the panel and its actions on the next request', async ({
	page,
	browser
}) => {
	await registerAs(page, 'admin');
	const victim = await (await browser.newContext()).newPage();
	const victimId = await registerAs(victim, 'admin');
	const [member] = await sql`
		insert into users (email, name) values (${`e2e-block-target-${crypto.randomUUID()}@example.com`}, 'Block Target')
		returning id, role`;
	expect((await victim.request.get('/admin', { maxRedirects: 0 })).status()).toBe(200);

	const block = await page.request.post(`/admin/users/${victimId}?/block`, {
		form: { comment: 'Compromised account' },
		headers: ORIGIN
	});
	expect(block.ok()).toBe(true);

	for (const path of ['/admin', '/admin/users', '/admin/audit/export']) {
		const res = await victim.request.get(path, { maxRedirects: 0 });
		expect(res.status(), path).toBe(303);
		expect(location(res), path).toMatch(toLogin);
	}
	const role = await victim.request.post(`/admin/users/${member.id}?/role`, {
		form: { role: 'admin' },
		headers: ORIGIN,
		maxRedirects: 0
	});
	/* Accept: any → SvelteKit answers a form action with JSON, the redirect is in the body. */
	expect(await role.json()).toMatchObject({
		type: 'redirect',
		location: expect.stringMatching(toLogin)
	});
	expect((await sql`select role from users where id = ${member.id}`)[0].role).toBe(member.role);
	await victim.goto('/');
	await expect(victim.getByRole('link', { name: 'Log in' })).toBeVisible();
});

test('status "blocked" set while the session row still exists: staff is a guest at once', async ({
	page
}) => {
	const id = await registerAs(page, 'editor');
	expect((await page.request.get('/admin', { maxRedirects: 0 })).status()).toBe(200);
	await sql`update users set status = 'blocked' where id = ${id}`;
	expect(await sql`select 1 from session where user_id = ${id}`).not.toHaveLength(0);
	const res = await page.request.get('/admin', { maxRedirects: 0 });
	expect(res.status()).toBe(303);
	expect(location(res)).toMatch(toLogin);
});
