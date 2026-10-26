import { existsSync } from 'node:fs';
import { expect, test } from '@playwright/test';
import postgres from 'postgres';
import { toYerevanInput } from '../../src/lib/validation/posts';
import { hydrated } from './hydrated';
import { journeyActors } from './journey-actors';

/* Journey (docs/09, 8.11): from the exam to the certificate anyone can check. The admin schedules
 * the "Advanced" exam for a member, records "passed" and issues the certificate from the exam card;
 * the member sees the new level, the certificate and its check link in "Progress"; a guest opens the
 * link and sees the holder and the level without contacts (docs/03 section 4, docs/05 sections 7-8,
 * docs/06 section 5.5). The PDF needs the private bucket — not checked here. */

if (!process.env.DATABASE_URL && existsSync('.env')) process.loadEnvFile('.env');
const sql = postgres(process.env.DATABASE_URL ?? '', { max: 1, onnotice: () => {} });
const actors = journeyActors(sql);
test.afterAll(() => sql.end());
test('admin schedules the exam, records the pass, issues the certificate; anyone can check it', async ({
	page,
	browser
}) => {
	test.setTimeout(180_000);
	const member = await actors.member(page, 'Cert');
	await actors.grantMembership(member);

	const admin = await (await browser.newContext()).newPage();
	await actors.staff(admin, 'admin');
	await admin.goto(`/admin/exams/new?q=${encodeURIComponent(member.name.split(' ')[1])}`);
	await admin.getByRole('link', { name: member.name }).click();
	await expect(admin).toHaveURL(new RegExp(`member=${member.id}`));
	await hydrated(admin);
	await admin.getByLabel('Exam type').selectOption('level_advanced');
	await admin.getByLabel('Date and time').fill(toYerevanInput(new Date(Date.now() - 3_600_000)));
	await admin.getByRole('button', { name: 'Schedule' }).click();
	await expect(admin).toHaveURL(/\/admin\/exams\/[0-9a-f-]{36}$/);

	await hydrated(admin);
	await admin.getByLabel('Passed').check();
	await admin.getByLabel('Score').fill('91');
	await admin.getByRole('button', { name: 'Save result' }).click();
	await expect(admin.getByText('91.00')).toBeVisible();

	await admin.getByRole('link', { name: 'Issue a certificate' }).click();
	await hydrated(admin);
	await expect(admin.getByLabel('Level', { exact: true })).toHaveValue('advanced');
	await admin.getByRole('button', { name: 'Issue' }).click();
	await expect(admin).toHaveURL(/\/admin\/certificates\/[0-9a-f-]{36}\?issued=/);
	await expect(admin.getByRole('status')).toContainText('Certificate issued');
	const [cert] = await sql`select c.number, c.public_token, c.status, u.level
		from certificates c join users u on u.id = c.user_id where c.user_id = ${member.id}`;
	expect(cert).toMatchObject({ status: 'active', level: 'advanced' });

	await page.goto('/cabinet/progress');
	const main = page.locator('main');
	const scale = main.getByRole('list', { name: 'Levels' });
	await expect(scale.locator('[aria-current="step"]')).toContainText('Advanced');
	const certs = main.getByRole('region', { name: 'Certificates' });
	await expect(certs.getByText(cert.number)).toBeVisible();
	const link = certs.getByLabel('Verification link');
	await expect(link).toHaveValue(new RegExp(`/certificate/${cert.public_token}$`));
	await expect(main.getByRole('region', { name: 'Exams' }).getByText('Passed')).toBeVisible();

	const guest = await (await browser.newContext()).newPage();
	await guest.goto(new URL(await link.inputValue()).pathname);
	const check = guest.locator('main');
	await expect(check.getByRole('heading', { level: 1 })).toHaveText('Certificate check');
	await expect(check.getByText(member.name)).toBeVisible();
	await expect(check.getByText('Level certificate "Advanced"')).toBeVisible();
	await expect(check.getByText(cert.number)).toBeVisible();
	expect(await guest.content()).not.toContain(member.email);
});
