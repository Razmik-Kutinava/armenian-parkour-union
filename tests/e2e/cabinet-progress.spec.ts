import { existsSync } from 'node:fs';
import { expect, test, type Page } from '@playwright/test';
import postgres from 'postgres';

/* docs/06 section 5.5: the level scale, own exams and certificates with the PDF, the verify link
 * and the QR, the coach profile; docs/04 section 5.3: another member's PDF is 404. Rows stay in
 * parkour_dev with the e2e user (global setup soft-deletes it). */

if (!process.env.DATABASE_URL && existsSync('.env')) process.loadEnvFile('.env');
const sql = postgres(process.env.DATABASE_URL ?? '', { max: 1, onnotice: () => {} });
test.afterAll(() => sql.end());

test.beforeEach(async () => {
	await sql`delete from rate_limit where key ~ '^sign-up:ip:(127\.0\.0\.1|::1|::ffff:127\.0\.0\.1)$'`;
});

async function register(page: Page) {
	const email = `e2e-progress-${crypto.randomUUID()}@example.com`;
	await page.goto('/register');
	await page.getByLabel('Email').fill(email);
	await page.getByLabel('Password').fill('parkour-pass-1');
	await page.getByLabel('First name').fill('Progress');
	await page.getByLabel('Last name').fill('Owner');
	await page.getByLabel('Date of birth').fill('1990-01-01');
	await page.getByLabel(/privacy policy/).check();
	await page.getByRole('button', { name: 'Create account' }).click();
	await expect(page).toHaveURL('/cabinet');
	const [user] = await sql`select id from users where email = ${email}`;
	return { id: user.id as string, email };
}

async function certificate(userId: string, kind: string, extra: Record<string, unknown> = {}) {
	const row = {
		user_id: userId,
		kind,
		number: `E2E-${crypto.randomUUID()}`,
		public_token: crypto.randomUUID().replaceAll('-', ''),
		issued_at: new Date(Date.now() - 86_400_000),
		issued_by: userId,
		...extra
	};
	const [cert] = await sql`insert into certificates ${sql(row)} returning id, number, public_token`;
	return {
		id: cert.id as string,
		number: cert.number as string,
		token: cert.public_token as string
	};
}

test('guest: the progress page sends to log in and back', async ({ page }) => {
	await page.goto('/cabinet/progress');
	await expect(page).toHaveURL('/login?returnTo=%2Fcabinet%2Fprogress');
});

test('member: level scale, next step, exams, certificates with link and QR, coach profile', async ({
	page
}) => {
	const me = await register(page);
	await sql`update users set level = 'advanced' where id = ${me.id}`;
	await sql`insert into memberships (user_id, status, starts_at, ends_at)
		values (${me.id}, 'active', now() - interval '30 days', now() + interval '300 days')`;
	const level = await certificate(me.id, 'level', {
		level: 'advanced',
		file_key: `certificates/${me.id}/level.pdf`
	});
	const coach = await certificate(me.id, 'trainer', {
		category: 'National',
		expires_at: new Date(Date.now() + 300 * 86_400_000)
	});
	const revoked = await certificate(me.id, 'judge', {
		status: 'revoked',
		revoked_at: new Date(),
		revoke_reason: 'E2e secret reason',
		file_key: `certificates/${me.id}/judge.pdf`
	});
	await sql`insert into staff_profiles (user_id, kind, category, license_number, is_public)
		values (${me.id}, 'trainer', 'National', 'LIC-E2E', true)`;
	await sql`insert into exams (user_id, kind, scheduled_at)
		values (${me.id}, 'level_pro', now() + interval '10 days')`;
	await sql`insert into exams (user_id, kind, scheduled_at, result, decided_at, notes)
		values (${me.id}, 'judge', now() - interval '20 days', 'failed', now() - interval '20 days',
			'E2e internal note')`;
	const [other] = await sql`insert into users (email, name, first_name, last_name, birth_date)
		values (${`e2e-progress-other-${crypto.randomUUID()}@example.com`}, 'Other Owner', 'Other',
			'Owner', '1990-01-01') returning id`;
	const foreign = await certificate(other.id, 'trainer', {
		file_key: `certificates/${other.id}/foreign.pdf`
	});

	await page.goto('/cabinet');
	const nav = page.getByRole('navigation', { name: 'Cabinet' });
	await nav.getByRole('link', { name: 'Progress' }).click();
	await expect(page).toHaveURL('/cabinet/progress');
	await expect(nav.getByRole('link', { name: 'Progress' })).toHaveAttribute('aria-current', 'page');
	const main = page.locator('main');

	const scale = main.getByRole('list', { name: 'Levels' });
	await expect(scale.getByRole('listitem')).toHaveCount(3);
	await expect(scale.locator('[aria-current="step"]')).toContainText('Advanced');
	await expect(main.getByText(/Next exam: Level "Pro" — scheduled/)).toBeVisible();

	const exams = main.getByRole('region', { name: 'Exams' });
	await expect(exams.getByRole('row')).toHaveCount(3);
	await expect(exams.getByText('Scheduled')).toBeVisible();
	await expect(exams.getByText('Failed')).toBeVisible();

	const certs = main.getByRole('region', { name: 'Certificates' });
	await expect(certs.getByText(level.number)).toBeVisible();
	await expect(certs.getByText(coach.number)).toBeVisible();
	await expect(certs.getByText(revoked.number)).toBeVisible();
	await expect(certs.getByText(foreign.number)).toHaveCount(0);
	await expect(certs.getByRole('link', { name: 'Download PDF' })).toHaveCount(1);
	await expect(certs.getByRole('link', { name: 'Download PDF' })).toHaveAttribute(
		'href',
		`/cabinet/progress/${level.id}/pdf`
	);
	await expect(certs.getByLabel('Verification link')).toHaveCount(2);
	const levelItem = certs.getByRole('listitem').filter({ hasText: level.number });
	await expect(levelItem.getByLabel('Verification link')).toHaveValue(
		new RegExp(`/certificate/${level.token}$`)
	);
	await levelItem.getByText('QR code', { exact: true }).click();
	await expect(
		levelItem.getByRole('img', { name: `QR code of certificate ${level.number}` })
	).toBeVisible();
	const revokedItem = certs.getByRole('listitem').filter({ hasText: revoked.number });
	await expect(revokedItem).toContainText('Revoked');
	await expect(revokedItem.getByText('QR code', { exact: true })).toHaveCount(0);

	const staff = main.getByRole('region', { name: 'My coach and judge profile' });
	await expect(staff).toContainText('LIC-E2E');
	await expect(staff).toContainText('Shown on the site');

	const html = await page.content();
	for (const secret of [me.email, 'E2e secret reason', 'E2e internal note', '.pdf'])
		expect(html).not.toContain(secret);

	for (const id of [foreign.id, revoked.id, crypto.randomUUID(), 'nope']) {
		const res = await page.request.get(`/cabinet/progress/${id}/pdf`, { maxRedirects: 0 });
		expect(res.status(), id).toBe(404);
	}
});
