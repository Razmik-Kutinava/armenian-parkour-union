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
	const email = `e2e-in-use-${crypto.randomUUID()}@example.com`;
	await page.goto('/register');
	await page.getByLabel('Email').fill(email);
	await page.getByLabel('Password').fill('parkour-pass-1');
	await page.getByLabel('First name').fill('Media');
	await page.getByLabel('Last name').fill('Editor');
	await page.getByLabel('Date of birth').fill('1990-01-01');
	await page.getByLabel(/privacy policy/).check();
	await page.getByRole('button', { name: 'Create account' }).click();
	await expect(page).toHaveURL('/', { timeout: 15_000 });
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

/* Stage 2 (docs/09, 2.11; docs/05 section 20): drafts and archived blocks keep their files too. */
test('a file used by a page, a post, an event or a hero block cannot be deleted', async ({
	page
}) => {
	test.setTimeout(90_000);
	const editorId = await registerEditor(page);
	const tag = `e2e-in-use-${crypto.randomUUID().slice(0, 8)}`;
	const title = sql.json({ en: `E2e hero in use ${tag}` });
	const [pageFile, postFile, eventFile, heroFile] = await Promise.all(
		['page', 'post', 'event', 'hero'].map((kind) => insertFile(editorId, `${tag}-${kind}.png`))
	);
	const body = sql.json({ en: `<p><img src="https://media.example/${pageFile.key}" alt=""></p>` });
	const [pageRow] = await sql`insert into pages (slug, title, body, status)
		values (${`${tag}-page`}, ${title}, ${body}, 'draft') returning id`;
	const [postRow] = await sql`insert into posts (slug, title, cover_key, status)
		values (${`${tag}-post`}, ${title}, ${postFile.key}, 'draft') returning id`;
	const [eventRow] = await sql`insert into events (slug, title, cover_key, starts_at, ends_at)
		values (${`${tag}-event`}, ${title}, ${eventFile.key}, now() + interval '10 days',
		now() + interval '11 days') returning id`;
	const [heroRow] = await sql`insert into hero_blocks (type, title, media_key, archived_at)
		values ('custom', ${title}, ${heroFile.key}, now()) returning id`;
	const cases = [
		{ file: pageFile, usedBy: `/admin/pages/${pageRow.id}` },
		{ file: postFile, usedBy: `/admin/news/${postRow.id}` },
		{ file: eventFile, usedBy: `/admin/events/${eventRow.id}` },
		{ file: heroFile, usedBy: `/admin/hero/${heroRow.id}` }
	];
	try {
		for (const { file, usedBy } of cases) {
			await page.goto(`/admin/media/${file.id}`);
			await expect(page.locator(`a[href="${usedBy}"]`), usedBy).toBeVisible();
			await expect(page.getByRole('button', { name: 'Delete' })).toBeDisabled();
			const forced = await page.request.post(`/admin/media/${file.id}?/delete`, {
				form: {},
				headers: { origin: 'http://localhost:4173' }
			});
			expect(forced.status(), usedBy).toBe(400);
		}
		const ids = cases.map((c) => c.file.id);
		expect(
			await sql`select id from media where id in ${sql(ids)} and deleted_at is not null`
		).toEqual([]);
		expect(
			await sql`select 1 from audit_log where action = 'media.delete' and entity_id in ${sql(ids)}`
		).toEqual([]);
	} finally {
		for (const table of ['pages', 'posts', 'events']) {
			await sql`update ${sql(table)} set deleted_at = now() where slug like ${`${tag}%`}`;
		}
	}
});
