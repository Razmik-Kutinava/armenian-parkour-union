import { existsSync } from 'node:fs';
import { expect, test, type Page } from '@playwright/test';
import postgres from 'postgres';
import { hydrated } from './hydrated';

/* docs/05 section 10, docs/06 section 5.10; decisions.md 2026-10-22 (5.2). The upload itself goes
 * to the private R2 bucket (not in CI): here — the cabinet, the review and what the member sees. */

if (!process.env.DATABASE_URL && existsSync('.env')) process.loadEnvFile('.env');
const sql = postgres(process.env.DATABASE_URL ?? '', { max: 1, onnotice: () => {} });
test.afterAll(() => sql.end());

test.beforeEach(async () => {
	await sql`delete from rate_limit where key ~ '^sign-up:ip:(127\.0\.0\.1|::1|::ffff:127\.0\.0\.1)$'`;
});

async function register(page: Page, prefix: string): Promise<string> {
	const email = `e2e-consent-${prefix}-${crypto.randomUUID()}@example.com`;
	await page.goto('/register');
	await page.getByLabel('Email').fill(email);
	await page.getByLabel('Password').fill('parkour-pass-1');
	await page.getByLabel('First name').fill('Consent');
	await page.getByLabel('Last name').fill(prefix);
	await page.getByLabel('Date of birth').fill('1990-01-01');
	await page.getByLabel(/privacy policy/).check();
	await page.getByRole('button', { name: 'Create account' }).click();
	await expect(page).toHaveURL('/cabinet');
	const [user] = await sql`select id from users where email = ${email}`;
	return user.id as string;
}

/** Made a minor after sign-up: the sign-up form for minors is covered by auth.spec.ts. */
async function makeMinor(id: string) {
	const year = new Date().getUTCFullYear() - 12;
	await sql`update users set birth_date = ${`${year}-01-01`}, guardian_name = 'Anna Parent',
		guardian_phone = '+374 10 000000', guardian_email = 'anna-parent@example.com'
		where id = ${id}`;
}

const pending = async (userId: string) =>
	(
		await sql`insert into consents (user_id, kind, file_key, signed_at, guardian_name)
			values (${userId}, 'parental', ${`consents/${userId}/${crypto.randomUUID()}.pdf`},
				'2026-10-01T00:00:00+04:00', 'Anna Parent') returning id`
	)[0].id as string;

test('a minor sees the documents; an adult only the medical clearance', async ({ page }) => {
	const id = await register(page, 'member');
	await page.goto('/cabinet/documents');
	await expect(page.getByRole('heading', { name: 'Documents', level: 1 })).toBeVisible();
	await expect(page.getByRole('region', { name: 'Medical clearance' })).toBeVisible();
	await expect(page.getByRole('region', { name: 'Parental consent' })).toHaveCount(0);

	await makeMinor(id);
	await page.goto('/cabinet');
	await expect(page.getByText('Upload the parental consent')).toBeVisible();
	await page.getByRole('link', { name: 'Documents' }).click();
	await expect(page).toHaveURL('/cabinet/documents');
	const parental = page.getByRole('region', { name: 'Parental consent' });
	await expect(parental.getByText('Not uploaded')).toBeVisible();
	await expect(page.getByRole('region', { name: 'Photo and video consent' })).toBeVisible();

	test.skip(!!process.env.R2_PRIVATE_BUCKET, 'with the private bucket the upload really runs');
	await hydrated(page);
	await parental.getByLabel('Date of signing').fill('2026-10-01');
	await parental.getByLabel('Scan or photo').setInputFiles({
		name: 'consent.pdf',
		mimeType: 'application/pdf',
		buffer: Buffer.from('%PDF-1.7\n')
	});
	await parental.getByRole('button', { name: 'Send for review' }).click();
	await expect(parental.getByText('Document upload is not available yet.')).toBeVisible();
	expect(await sql`select 1 from consents where user_id = ${id}`).toHaveLength(0);
});

test('a moderator rejects with a reason, then approves; the member sees both', async ({
	page,
	browser
}) => {
	test.setTimeout(90_000);
	const member = await register(page, 'minor');
	await makeMinor(member);
	const staffPage = await (await browser.newContext()).newPage();
	const moderator = await register(staffPage, 'moderator');
	await sql`update users set role = 'moderator' where id = ${moderator}`;

	const first = await pending(member);
	await staffPage.goto(`/admin/consents?q=${encodeURIComponent('Consent minor')}&status=pending`);
	await staffPage.getByRole('table').getByRole('link', { name: 'Consent minor' }).first().click();
	await expect(staffPage).toHaveURL(new RegExp('/admin/consents/[0-9a-f-]{36}$'));
	await staffPage.goto(`/admin/consents/${first}`);
	await expect(staffPage.getByText('Anna Parent').first()).toBeVisible();
	await expect(staffPage.getByText('anna-parent@example.com')).toBeVisible();
	await hydrated(staffPage);
	await staffPage.getByLabel('Reason').fill('The signature is missing');
	await staffPage.getByRole('button', { name: 'Reject' }).click();
	await expect(staffPage.getByText('Decision saved.')).toBeVisible();

	await page.goto('/cabinet/documents');
	const parental = page.getByRole('region', { name: 'Parental consent' });
	await expect(parental.getByText('Rejected')).toBeVisible();
	await expect(parental.getByText('The signature is missing')).toBeVisible();

	const second = await pending(member);
	await staffPage.goto(`/admin/consents/${second}`);
	await hydrated(staffPage);
	await staffPage.getByLabel('Valid until').fill('2099-12-31');
	await staffPage.getByRole('button', { name: 'Approve' }).click();
	await expect(staffPage.getByText('Decision saved.')).toBeVisible();
	await expect(staffPage.getByRole('button', { name: 'Approve' })).toHaveCount(0);

	await page.reload();
	await expect(parental.getByText('Approved')).toBeVisible();
	await page.goto('/cabinet');
	await expect(page.getByText('Upload the parental consent')).toHaveCount(0);
	const log =
		await sql`select action from audit_log where actor_id = ${moderator} order by created_at`;
	expect(log.map((r) => r.action)).toEqual(['consent.reject', 'consent.approve']);
});
