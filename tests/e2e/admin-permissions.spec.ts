import { existsSync } from 'node:fs';
import { expect, test, type Page } from '@playwright/test';
import postgres from 'postgres';
import { roleCan } from '../../src/lib/server/auth/permissions';
import { ADMIN_READS, ADMIN_WRITES, type Access } from './admin-access-map';

if (!process.env.DATABASE_URL && existsSync('.env')) process.loadEnvFile('.env');
const sql = postgres(process.env.DATABASE_URL ?? '', { max: 1, onnotice: () => {} });
test.afterAll(() => sql.end());
/* Only sign-up counters: auth.spec.ts runs in parallel and checks the sign-in limit. */
test.beforeEach(async () => {
	await sql`delete from rate_limit where key ~ '^sign-up:ip:(127\.0\.0\.1|::1|::ffff:127\.0\.0\.1)$'`;
});

type Role = 'member' | 'editor' | 'moderator' | 'admin';
const ORIGIN = { origin: 'http://localhost:4173' };
/* Every field any admin form reads: if a guard were missing, the action would really run. */
const HOSTILE_FORM = (userId: string) => ({
	userId,
	role: 'admin',
	comment: 'hostile',
	email: `e2e-hostile-${crypto.randomUUID()}@example.com`,
	firstName: 'Hacked',
	lastName: 'Hacked',
	birthDate: '1990-01-01',
	locale: 'hy',
	'alt.en': 'Hacked',
	key: `media/2026/10/${crypto.randomUUID()}.png`,
	name: 'hacked.png',
	mime: 'image/png',
	size: '10'
});

async function registerAs(page: Page, role: Role) {
	const email = `e2e-perm-${role}-${crypto.randomUUID()}@example.com`;
	await page.goto('/register');
	await page.getByLabel('Email').fill(email);
	await page.getByLabel('Password').fill('parkour-pass-1');
	await page.getByLabel('First name').fill('Perm');
	await page.getByLabel('Last name').fill(role);
	await page.getByLabel('Date of birth').fill('1990-01-01');
	await page.getByLabel(/privacy policy/).check();
	await page.getByRole('button', { name: 'Create account' }).click();
	await expect(page).toHaveURL('/');
	await sql`update users set role = ${role} where email = ${email}`;
}

async function insertMember() {
	const email = `e2e-perm-target-${crypto.randomUUID()}@example.com`;
	const [row] = await sql`
		insert into users (email, name, first_name, last_name, birth_date)
		values (${email}, 'Perm Target', 'Perm', 'Target', '1990-01-01') returning id`;
	return row.id as string;
}

async function insertMedia(uploadedBy: string) {
	const [row] = await sql`
		insert into media (key, original_name, mime, size_bytes, uploaded_by)
		values (${`media/2026/10/${crypto.randomUUID()}.png`}, 'perm.png', 'image/png', 10, ${uploadedBy})
		returning id`;
	return row.id as string;
}

/* docs/04 section 5.4: member → 404 for all of /admin, staff without the permission → 403. */
const expectedStatus = (role: Role, access: Access) =>
	role === 'member' ? 404 : access === 'staff' || roleCan(role, access) ? 200 : 403;

type Ids = { userId: string; auditId: string; mediaId: string };
const toPath = (key: string, ids: Ids) =>
	key
		.replace(/^(GET|POST) /, '')
		.replace('/users/[id]', `/users/${ids.userId}`)
		.replace('/audit/[id]', `/audit/${ids.auditId}`)
		.replace('/media/[id]', `/media/${ids.mediaId}`)
		.replace('?/default', '');

const targetRow = async (id: string) =>
	(await sql`select role, status, email_verified, first_name from users where id = ${id}`)[0];
const mediaRow = async (id: string) =>
	(await sql`select alt, deleted_at from media where id = ${id}`)[0];

for (const role of ['member', 'editor', 'moderator'] as const) {
	test(`${role}: every admin page and action answers by docs/04, data stays`, async ({ page }) => {
		const target = await insertMember();
		const before = await targetRow(target);
		const ids = {
			userId: target,
			auditId: crypto.randomUUID(),
			mediaId: await insertMedia(target)
		};
		const mediaBefore = await mediaRow(ids.mediaId);
		await registerAs(page, role);

		for (const [key, access] of Object.entries(ADMIN_READS)) {
			const res = await page.request.get(toPath(key, ids), { maxRedirects: 0 });
			expect(res.status(), `GET ${key}`).toBe(expectedStatus(role, access));
		}
		for (const [key, access] of Object.entries(ADMIN_WRITES)) {
			const expected = expectedStatus(role, access);
			if (expected === 200) continue;
			const res = await page.request.post(toPath(key, ids), {
				form: HOSTILE_FORM(target),
				headers: ORIGIN,
				maxRedirects: 0
			});
			expect(res.status(), `POST ${key}`).toBe(expected);
		}

		expect(await targetRow(target)).toEqual(before);
		expect(await mediaRow(ids.mediaId)).toEqual(mediaBefore);
		expect(
			await sql`select 1 from audit_log where entity_id in (${target}, ${ids.mediaId})`
		).toHaveLength(0);
	});
}

test('admin opens every admin page; audit pages take no writes and the entry stays', async ({
	page
}) => {
	await registerAs(page, 'admin');
	const target = await insertMember();
	const confirm = await page.request.post(`/admin/users/${target}?/confirmEmail`, {
		form: {},
		headers: ORIGIN
	});
	expect(confirm.ok()).toBe(true);
	const [entry] = await sql`select * from audit_log where entity_id = ${target}`;
	expect(entry.action).toBe('user.email_confirm');

	const ids = { userId: target, auditId: entry.id, mediaId: await insertMedia(target) };
	for (const key of Object.keys(ADMIN_READS)) {
		const res = await page.request.get(toPath(key, ids), { maxRedirects: 0 });
		expect(res.status(), `GET ${key}`).toBe(200);
	}
	for (const path of ['/admin/audit', `/admin/audit/${entry.id}`, '/admin/audit/export']) {
		for (const method of ['POST', 'PUT', 'PATCH', 'DELETE']) {
			const res = await page.request.fetch(path, {
				method,
				form: { action: 'changed', id: entry.id },
				headers: ORIGIN,
				maxRedirects: 0
			});
			expect(res.status(), `${method} ${path}`).toBe(405);
		}
	}
	expect(await sql`select * from audit_log where entity_id = ${target}`).toEqual([entry]);
});
