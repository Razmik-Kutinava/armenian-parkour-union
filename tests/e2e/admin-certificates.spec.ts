import { existsSync } from 'node:fs';
import { expect, test } from '@playwright/test';
import postgres from 'postgres';
import { permissionFixtures } from './admin-permissions-fixtures';
import { hydrated } from './hydrated';

/* docs/05 section 8: from a passed exam the admin issues the level certificate (the level goes up,
 * docs/03 section 4), sees the number and the verify link, revokes it with a reason (the level
 * stays, docs/03 section 4.7); the list filters by state. No member contacts on the pages. */

if (!process.env.DATABASE_URL && existsSync('.env')) process.loadEnvFile('.env');
const sql = postgres(process.env.DATABASE_URL ?? '', { max: 1, onnotice: () => {} });
test.afterAll(() => sql.end());
test.beforeEach(async () => {
	await sql`delete from rate_limit where key ~ '^sign-up:ip:(127\.0\.0\.1|::1|::ffff:127\.0\.0\.1)$'`;
});

test('admin issues a certificate from a passed exam and revokes it', async ({ page }) => {
	test.setTimeout(120_000);
	const last = `Cert${crypto.randomUUID().slice(0, 8)}`;
	const email = `e2e-cert-${crypto.randomUUID()}@example.com`;
	const [member] = await sql`
		insert into users (email, name, first_name, last_name, birth_date, email_verified, level)
		values (${email}, ${`Ani ${last}`}, 'Ani', ${last}, '1990-01-01', true, 'novice')
		returning id`;
	const [exam] = await sql`
		insert into exams (user_id, kind, scheduled_at, result, score, decided_at)
		values (${member.id}, 'level_advanced', now() - interval '2 days', 'passed', 90, now())
		returning id`;
	await permissionFixtures(sql).registerAs(page, 'admin');

	await page.goto(`/admin/exams/${exam.id}`);
	await page.getByRole('link', { name: 'Issue a certificate' }).click();
	await expect(page).toHaveURL(new RegExp(`exam=${exam.id}`));
	await hydrated(page);
	await expect(page.getByLabel('Certificate type')).toHaveValue('level');
	await expect(page.getByLabel('Level', { exact: true })).toHaveValue('advanced');
	await expect(page.getByLabel('Exam', { exact: true })).toHaveValue(exam.id);
	await page.getByRole('button', { name: 'Issue' }).click();

	await expect(page).toHaveURL(/\/admin\/certificates\/[0-9a-f-]{36}\?issued=/);
	const [cert] = await sql`select c.id, c.number, c.public_token, c.status, c.exam_id, u.level
		from certificates c join users u on u.id = c.user_id where c.user_id = ${member.id}`;
	expect(cert).toMatchObject({ status: 'active', exam_id: exam.id, level: 'advanced' });
	await expect(page.getByRole('heading', { level: 1 })).toContainText(cert.number);
	await expect(page.getByRole('status')).toContainText('Certificate issued');
	await expect(page.getByLabel('Verification link')).toHaveValue(
		new RegExp(`/certificate/${cert.public_token}$`)
	);
	expect(await page.content()).not.toContain(email);

	await page.goto(`/admin/exams/${exam.id}`);
	await expect(page.getByRole('link', { name: cert.number })).toBeVisible();
	await expect(page.getByRole('link', { name: 'Issue a certificate' })).toHaveCount(0);

	await page.goto(`/admin/certificates/${cert.id}`);
	const dialog = page.getByRole('dialog');
	/* A click before hydration does not open the dialog: click until it opens. */
	await expect(async () => {
		await page.getByRole('button', { name: 'Revoke' }).click();
		await expect(dialog).toBeVisible({ timeout: 1000 });
	}).toPass();
	await dialog.getByLabel('Comment (required)').fill('Issued by mistake');
	await dialog.getByRole('button', { name: 'Revoke' }).click();
	await expect(page.getByText('Revoked', { exact: true })).toBeVisible();
	const [after] = await sql`select c.status, c.revoke_reason, u.level from certificates c
		join users u on u.id = c.user_id where c.id = ${cert.id}`;
	expect(after).toEqual({
		status: 'revoked',
		revoke_reason: 'Issued by mistake',
		level: 'advanced'
	});
	await expect(page.getByRole('button', { name: 'Revoke' })).toHaveCount(0);

	await page.goto(`/admin/certificates?q=${last}&state=revoked`);
	await expect(page.getByRole('link', { name: cert.number })).toBeVisible();
	await page.goto(`/admin/certificates?q=${last}&state=active`);
	await expect(page.getByRole('link', { name: cert.number })).toHaveCount(0);
});

test('moderator sees the certificate but cannot issue, remake or revoke', async ({ page }) => {
	const [member] = await sql`
		insert into users (email, name, first_name, last_name, birth_date)
		values (${`e2e-cert-${crypto.randomUUID()}@example.com`}, 'Mod View', 'Mod', 'View',
			'1990-01-01') returning id`;
	const [cert] = await sql`
		insert into certificates (user_id, kind, number, public_token, issued_at, expires_at, issued_by)
		values (${member.id}, 'judge', ${`E2E-${crypto.randomUUID()}`}, ${crypto.randomUUID()}, now(),
			now() + interval '300 days', ${member.id}) returning id, number`;
	await permissionFixtures(sql).registerAs(page, 'moderator');

	await page.goto(`/admin/certificates/${cert.id}`);
	await expect(page.getByRole('heading', { level: 1 })).toContainText(cert.number);
	await expect(page.getByRole('button', { name: 'Revoke' })).toHaveCount(0);
	await expect(page.getByRole('button', { name: 'Remake PDF' })).toHaveCount(0);
	await page.goto('/admin/certificates');
	await expect(page.getByRole('link', { name: 'Issue a certificate' })).toHaveCount(0);
});
