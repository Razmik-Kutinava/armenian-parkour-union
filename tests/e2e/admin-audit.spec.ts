import { existsSync } from 'node:fs';
import { expect, test, type Page } from '@playwright/test';
import postgres from 'postgres';
import { ADMIN_AUDIT, type AdminAction } from './admin-audit-map';

if (!process.env.DATABASE_URL && existsSync('.env')) process.loadEnvFile('.env');
const sql = postgres(process.env.DATABASE_URL ?? '', { max: 1, onnotice: () => {} });
test.afterAll(() => sql.end());
/* Only sign-up counters: auth.spec.ts runs in parallel and checks the sign-in limit. */
test.beforeEach(async () => {
	await sql`delete from rate_limit where key ~ '^sign-up:ip:(127\.0\.0\.1|::1|::ffff:127\.0\.0\.1)$'`;
});

const ORIGIN = { origin: 'http://localhost:4173' };
const PROFILE = { firstName: 'Audit', lastName: 'Target', birthDate: '1991-03-03' };

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
	await expect(page).toHaveURL('/');
	const [row] = await sql`select id from users where email = ${email}`;
	return row.id as string;
}

test('every admin action leaves an audit entry with author and IP', async ({ page, browser }) => {
	test.setTimeout(90_000);
	const adminId = await register(page, 'admin');
	await sql`update users set role = 'admin' where id = ${adminId}`;
	const target = await register(await (await browser.newContext()).newPage(), 'target');
	const post = async (path: string, form: Record<string, string> = {}) => {
		const res = await page.request.post(path, { form, headers: ORIGIN });
		expect(res.ok(), path).toBe(true);
	};
	const card = `/admin/users/${target}`;

	/* Typed by the map: a new admin action does not compile until it is exercised here. */
	const perform: Record<AdminAction, () => Promise<void>> = {
		'/admin/users/[id]?/update': () => post(`${card}?/update`, { ...PROFILE, city: 'Gyumri' }),
		'/admin/users/[id]?/role': () => post(`${card}?/role`, { role: 'editor' }),
		'/admin/roles?/grant': () => post('/admin/roles?/grant', { userId: target, role: 'moderator' }),
		'/admin/roles?/revoke': () => post('/admin/roles?/revoke', { userId: target }),
		'/admin/users/[id]?/block': () => post(`${card}?/block`, { comment: 'Audit check' }),
		'/admin/users/[id]?/unblock': () => post(`${card}?/unblock`),
		'/admin/users/[id]?/confirmEmail': () => post(`${card}?/confirmEmail`),
		'/admin/users/[id]?/passwordLink': () => post(`${card}?/passwordLink`),
		'/admin/users/new?/default': () =>
			post('/admin/users/new', {
				...PROFILE,
				email: `e2e-audit-new-${crypto.randomUUID()}@example.com`
			}),
		/* The stored form as rendered, phone changed: no typing before hydration. */
		'/admin/settings?/default': async () => {
			await page.goto('/admin/settings');
			const field = page.getByLabel('Phone', { exact: true });
			const form = await field.evaluate((el: HTMLInputElement) =>
				Object.fromEntries([...new FormData(el.form!)].map(([k, v]) => [k, String(v)]))
			);
			const name = (await field.getAttribute('name'))!;
			const phone = `+374 10 ${String(Math.floor(Math.random() * 1e6)).padStart(6, '0')}`;
			await post('/admin/settings', { ...form, [name]: phone });
		}
	};

	for (const [action, run] of Object.entries(perform)) await test.step(action, run);

	const rows = await sql`select action, host(ip) as ip from audit_log where actor_id = ${adminId}`;
	for (const row of rows) expect(row.ip, row.action).not.toBeNull();
	/* settings.update writes one entry per changed key, the rest exactly one per action */
	const userCodes = rows.map((r) => r.action as string).filter((a) => a !== 'settings.update');
	const expected = Object.values(ADMIN_AUDIT)
		.flat()
		.filter((a) => a !== 'settings.update');
	expect(userCodes.sort()).toEqual(expected.sort());
	expect(rows.some((r) => r.action === 'settings.update')).toBe(true);
});
