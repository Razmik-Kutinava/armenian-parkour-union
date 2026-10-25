import { existsSync } from 'node:fs';
import { expect, test, type Page } from '@playwright/test';
import postgres from 'postgres';
import { hydrated } from './hydrated';

/* docs/05 sections 11 and 21, docs/03 section 8: the queue, quick buttons, a batch, points on
 * approval; the video settings tab (docs/todo.md 7.2). Rows stay in parkour_dev with e2e users. */

if (!process.env.DATABASE_URL && existsSync('.env')) process.loadEnvFile('.env');
const sql = postgres(process.env.DATABASE_URL ?? '', { max: 1, onnotice: () => {} });
test.afterAll(() => sql.end());

test.beforeEach(async () => {
	await sql`delete from rate_limit where key ~ '^sign-up:ip:(127\.0\.0\.1|::1|::ffff:127\.0\.0\.1)$'`;
});

async function registerAs(page: Page, role: 'moderator' | 'admin') {
	const email = `e2e-videos-${role}-${crypto.randomUUID()}@example.com`;
	await page.goto('/register');
	await page.getByLabel('Email').fill(email);
	await page.getByLabel('Password').fill('parkour-pass-1');
	await page.getByLabel('First name').fill('Videos');
	await page.getByLabel('Last name').fill(role);
	await page.getByLabel('Date of birth').fill('1990-01-01');
	await page.getByLabel(/privacy policy/).check();
	await page.getByRole('button', { name: 'Create account' }).click();
	await expect(page).toHaveURL('/cabinet');
	const [user] = await sql`update users set role = ${role} where email = ${email} returning id`;
	return user.id as string;
}

async function insertMember(tag: string) {
	const [user] = await sql`insert into users (email, name, first_name, last_name, birth_date)
		values (${`e2e-videos-member-${tag}@example.com`}, ${`Clip ${tag}`}, 'Clip', ${tag},
			'1990-01-01') returning id`;
	return user.id as string;
}

let n = 0;
async function insertVideo(userId: string, title: string, minutesAgo: number) {
	n += 1;
	const id = `${crypto.randomUUID().replace(/-/g, '').slice(0, 9)}${String(n).padStart(2, '0')}`;
	const [row] = await sql`insert into videos (user_id, url, platform, title, created_at)
		values (${userId}, ${`https://www.youtube.com/watch?v=${id}`}, 'youtube', ${title},
			now() - make_interval(mins => ${minutesAgo})) returning id, url`;
	return row as { id: string; url: string };
}

const videoRow = async (id: string) =>
	(await sql`select status, reject_reason, hidden_at, reviewed_by from videos where id = ${id}`)[0];

test('a moderator approves, rejects with a reason, hides, and approves a batch', async ({
	page
}) => {
	test.setTimeout(90_000);
	// CI only migrates the e2e database; parkour_dev already has the seeded rule.
	await sql`insert into points_rules (code, title, points, is_active)
		values ('video_approved', ${sql.json({ en: 'Approved video' })}, 10, true)
		on conflict (code) do nothing`;
	const tag = crypto.randomUUID().slice(0, 8);
	const member = await insertMember(tag);
	const first = await insertVideo(member, 'E2e first', 30);
	const second = await insertVideo(member, 'E2e second', 20);
	const third = await insertVideo(member, 'E2e third', 10);
	const moderator = await registerAs(page, 'moderator');

	await page.goto('/admin');
	await page.getByRole('navigation').getByRole('link', { name: 'Videos' }).click();
	await expect(page).toHaveURL('/admin/videos');
	await page.goto(`/admin/videos?q=${tag}`);
	await hydrated(page);
	const table = page.getByRole('table');
	const rows = table.getByRole('row');
	await expect(rows).toHaveCount(4);
	await expect(rows.nth(1)).toContainText('E2e first');
	await expect(rows.nth(3)).toContainText('E2e third');
	const link = rows.nth(1).getByRole('link', { name: 'E2e first' });
	await expect(link).toHaveAttribute('href', first.url);
	await expect(link).toHaveAttribute('target', '_blank');

	await rows.nth(1).getByRole('button', { name: 'Approve' }).click();
	await expect(page.getByText('Done: 1. Skipped: 0.')).toBeVisible();
	expect(await videoRow(first.id)).toMatchObject({ status: 'approved', reviewed_by: moderator });
	const points = await sql`select delta from points_ledger
		where user_id = ${member} and reason = 'video' and source_id = ${first.id}`;
	expect(points).toHaveLength(1);

	await hydrated(page);
	await table
		.getByRole('row')
		.filter({ hasText: 'E2e second' })
		.getByRole('button', { name: 'Reject' })
		.click();
	const dialog = page.getByRole('dialog');
	await dialog.getByLabel(/Comment/).fill('Not parkour');
	await dialog.getByRole('button', { name: 'Reject' }).click();
	await expect(page.getByText('Done: 1. Skipped: 0.')).toBeVisible();
	expect(await videoRow(second.id)).toMatchObject({
		status: 'rejected',
		reject_reason: 'Not parkour'
	});

	await page.goto(`/admin/videos?q=${tag}&status=approved`);
	await hydrated(page);
	await page
		.getByRole('table')
		.getByRole('row')
		.filter({ hasText: 'E2e first' })
		.getByRole('button', { name: 'Hide' })
		.click();
	await expect(page.getByText('Done: 1. Skipped: 0.')).toBeVisible();
	expect((await videoRow(first.id)).hidden_at).not.toBeNull();

	const fourth = await insertVideo(member, 'E2e fourth', 5);
	await page.goto(`/admin/videos?q=${tag}`);
	await hydrated(page);
	await page.getByRole('table').getByLabel('Select all').check();
	await page.getByRole('button', { name: 'Approve selected' }).click();
	await expect(page.getByText('Done: 2. Skipped: 0.')).toBeVisible();
	expect((await videoRow(third.id)).status).toBe('approved');
	expect((await videoRow(fourth.id)).status).toBe('approved');
	const awards =
		await sql`select 1 from points_ledger where user_id = ${member} and reason = 'video'`;
	expect(awards).toHaveLength(3);

	const log = await sql`select action from audit_log where actor_id = ${moderator}
		order by created_at, action`;
	expect(log.map((r) => r.action)).toEqual([
		'video.approve',
		'video.reject',
		'video.hide',
		'video.approve',
		'video.approve'
	]);
});

test('admin: the video settings tab checks the values; a moderator has no access', async ({
	page
}) => {
	const admin = await registerAs(page, 'admin');
	await page.goto('/admin/settings');
	await page
		.getByRole('navigation', { name: 'Settings sections' })
		.getByRole('link', { name: 'Videos' })
		.click();
	await expect(page).toHaveURL('/admin/settings/videos');
	await hydrated(page);
	const limit = page.getByLabel('Videos a month');
	await expect(limit).not.toHaveValue('');
	await limit.fill('0');
	await page.getByRole('button', { name: 'Save' }).click();
	await expect(page.getByText('From 1 to 100.')).toBeVisible();
	expect(
		await sql`select 1 from audit_log where actor_id = ${admin} and action = 'settings.update'`
	).toHaveLength(0);

	await sql`update users set role = 'moderator' where id = ${admin}`;
	expect((await page.goto('/admin/settings/videos'))?.status()).toBe(403);
});
