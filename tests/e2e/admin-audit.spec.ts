import { existsSync } from 'node:fs';
import { expect, test, type Page } from '@playwright/test';
import postgres from 'postgres';
import { adminActions } from './admin-audit-actions';
import { ADMIN_AUDIT } from './admin-audit-map';

if (!process.env.DATABASE_URL && existsSync('.env')) process.loadEnvFile('.env');
const sql = postgres(process.env.DATABASE_URL ?? '', { max: 1, onnotice: () => {} });
test.afterAll(() => sql.end());
/* Only sign-up counters: auth.spec.ts runs in parallel and checks the sign-in limit. */
test.beforeEach(async () => {
	await sql`delete from rate_limit where key ~ '^sign-up:ip:(127\.0\.0\.1|::1|::ffff:127\.0\.0\.1)$'`;
});

async function register(page: Page, prefix: string) {
	const email = `e2e-audit-${prefix}-${crypto.randomUUID()}@example.com`;
	await page.goto('/register');
	await page.getByLabel('Email').fill(email);
	await page.getByLabel('Password').fill('parkour-pass-1');
	await page.getByLabel('First name').fill('Audit');
	await page.getByLabel('Last name').fill(prefix);
	await page.getByLabel('Date of birth').fill('1990-01-01');
	await page.getByLabel(/privacy policy/).check();
	await page.getByRole('button', { name: 'Create account' }).click();
	await expect(page).toHaveURL('/cabinet');
	const [row] = await sql`select id from users where email = ${email}`;
	return row.id as string;
}

test('every admin action leaves an audit entry with author and IP', async ({ page, browser }) => {
	test.setTimeout(150_000);
	const adminId = await register(page, 'admin');
	await sql`update users set role = 'admin' where id = ${adminId}`;
	const target = await register(await (await browser.newContext()).newPage(), 'target');
	const perform = await adminActions(page, sql, adminId, target);
	for (const [action, run] of Object.entries(perform)) await test.step(action, run);

	const rows = await sql`select action, host(ip) as ip from audit_log where actor_id = ${adminId}`;
	for (const row of rows) expect(row.ip, row.action).not.toBeNull();
	/* settings.update writes one entry per changed key, the rest exactly one per action */
	const userCodes = rows.map((r) => r.action as string).filter((a) => a !== 'settings.update');
	const expected = Object.values(ADMIN_AUDIT)
		.flat()
		.filter((a) => a !== 'settings.update' && a !== 'media.upload');
	expect(userCodes.sort()).toEqual(expected.sort());
	expect(rows.some((r) => r.action === 'settings.update')).toBe(true);
});
