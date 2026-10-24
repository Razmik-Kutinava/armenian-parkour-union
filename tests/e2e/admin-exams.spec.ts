import { existsSync } from 'node:fs';
import { expect, test } from '@playwright/test';
import postgres from 'postgres';
import { toYerevanInput } from '../../src/lib/validation/posts';
import { permissionFixtures } from './admin-permissions-fixtures';
import { hydrated } from './hydrated';

/* docs/05 section 7: a moderator finds a member, schedules an exam (a level that does not fit only
 * warns), records the result on the card; the list filters by result. The level never changes
 * (docs/03 section 3.2), the member's contacts never reach a moderator (docs/04 section 4). */

if (!process.env.DATABASE_URL && existsSync('.env')) process.loadEnvFile('.env');
const sql = postgres(process.env.DATABASE_URL ?? '', { max: 1, onnotice: () => {} });
test.afterAll(() => sql.end());
test.beforeEach(async () => {
	await sql`delete from rate_limit where key ~ '^sign-up:ip:(127\.0\.0\.1|::1|::ffff:127\.0\.0\.1)$'`;
});

test('moderator schedules over the level warning and records the result', async ({ page }) => {
	test.setTimeout(90_000);
	const last = `Exam${crypto.randomUUID().slice(0, 8)}`;
	const email = `e2e-exam-${crypto.randomUUID()}@example.com`;
	const [member] = await sql`
		insert into users (email, name, first_name, last_name, birth_date, email_verified, level)
		values (${email}, ${`Ani ${last}`}, 'Ani', ${last}, '1990-01-01', true, 'novice')
		returning id`;
	await sql`insert into memberships (user_id, status, starts_at, ends_at)
		values (${member.id}, 'active', now() - interval '1 day', now() + interval '300 days')`;
	await permissionFixtures(sql).registerAs(page, 'moderator');

	await page.goto(`/admin/exams/new?q=${last}`);
	await page.getByRole('link', { name: `Ani ${last}` }).click();
	await expect(page).toHaveURL(new RegExp(`member=${member.id}`));
	await hydrated(page);
	await page.getByLabel('Exam type').selectOption('level_pro');
	await page.getByLabel('Date and time').fill(toYerevanInput(new Date(Date.now() - 3_600_000)));
	await page.getByRole('button', { name: 'Schedule' }).click();
	await expect(page.getByText(/does not fit this exam/)).toBeVisible();
	expect(await sql`select 1 from exams where user_id = ${member.id}`).toHaveLength(0);

	await page.getByLabel('Schedule anyway').check();
	await page.getByRole('button', { name: 'Schedule' }).click();
	await expect(page).toHaveURL(/\/admin\/exams\/[0-9a-f-]{36}$/);
	await expect(page.getByRole('heading', { level: 1 })).toContainText(`Ani ${last}`);
	expect(await page.content()).not.toContain(email);

	await hydrated(page);
	await page.getByLabel('Passed').check();
	await page.getByLabel('Score').fill('87.5');
	await page.getByRole('button', { name: 'Save result' }).click();
	await expect(page.getByText('87.50')).toBeVisible();
	const [row] = await sql`select e.result, e.score, e.kind, u.level from exams e
		join users u on u.id = e.user_id where e.user_id = ${member.id}`;
	expect(row).toEqual({ result: 'passed', score: '87.50', kind: 'level_pro', level: 'novice' });

	await page.goto(`/admin/exams?q=${last}&result=passed`);
	await expect(page.getByRole('link', { name: `Ani ${last}` })).toBeVisible();
	await page.goto(`/admin/exams?q=${last}&result=failed`);
	await expect(page.getByRole('link', { name: `Ani ${last}` })).toHaveCount(0);
});
