import { existsSync } from 'node:fs';
import { expect, test } from '@playwright/test';
import postgres from 'postgres';

/* docs/06 section 4.10: the QR in the PDF leads here. Name, type and level, number, dates and the
 * status; no contacts, birth date or revoke reason; not indexed. Rows are written here directly. */

if (!process.env.DATABASE_URL && existsSync('.env')) process.loadEnvFile('.env');
const sql = postgres(process.env.DATABASE_URL ?? '', { max: 1, onnotice: () => {} });

const TAG = `e2e-cert-${crypto.randomUUID().slice(0, 8)}`;
const EMAIL = `${TAG}@example.com`;
const PHONE = '+37499000777';
let ownerId = '';

test.beforeAll(async () => {
	const [user] = await sql`insert into users (email, name, first_name, last_name, birth_date,
		phone, guardian_email, locale) values (${EMAIL}, ${TAG}, 'Ani', 'Hakobyan', '2011-07-19',
		${PHONE}, ${`guardian-${EMAIL}`}, 'en') returning id`;
	ownerId = user.id as string;
});

test.afterAll(async () => {
	await sql`delete from certificates where user_id = ${ownerId}`;
	await sql`update users set deleted_at = now() where id = ${ownerId}`;
	await sql.end();
});

type Cert = { kind: string; level?: string; status?: string; expires?: string; reason?: string };

async function certificate(c: Cert): Promise<{ token: string; number: string }> {
	const token = crypto.randomUUID().replaceAll('-', '');
	const number = `E2E-${token.slice(0, 12)}`;
	const revoked = c.status === 'revoked';
	await sql`insert into certificates (user_id, kind, level, number, public_token, status,
		issued_at, expires_at, issued_by, revoked_at, revoke_reason)
		values (${ownerId}, ${c.kind}, ${c.level ?? null}, ${number}, ${token},
		${c.status ?? 'active'}, '2026-03-05T10:00:00Z', ${c.expires ?? null}, ${ownerId},
		${revoked ? new Date() : null}, ${c.reason ?? null})`;
	return { token, number };
}

test('unknown or broken token: 404', async ({ request }) => {
	for (const path of ['/certificate/nope', `/certificate/${'a'.repeat(80)}`, '/ru/certificate/x']) {
		const res = await request.get(path, { maxRedirects: 0 });
		expect(res.status(), path).toBe(404);
	}
});

test('active level certificate: name, type, number, date; no personal data; noindex', async ({
	page
}) => {
	const { token, number } = await certificate({ kind: 'level', level: 'advanced' });
	const res = await page.goto(`/certificate/${token}`);
	expect(res?.headers()['x-robots-tag']).toBe('noindex');
	expect(res?.headers()['cache-control']).toBe('no-store');
	await expect(page.locator('meta[name="robots"]')).toHaveAttribute('content', 'noindex');

	const main = page.locator('main');
	await expect(main.getByRole('heading', { level: 1 })).toHaveText('Certificate check');
	await expect(main.getByRole('status')).toHaveText('Valid');
	await expect(main.getByText('Ani Hakobyan')).toBeVisible();
	await expect(main.getByText('Level certificate "Advanced"')).toBeVisible();
	await expect(main.getByText(number)).toBeVisible();
	await expect(main.getByText('March 5, 2026')).toBeVisible();
	await expect(main.getByText('Valid until')).toHaveCount(0);

	const html = await page.content();
	for (const secret of [EMAIL, TAG, PHONE, '2011', ownerId]) expect(html).not.toContain(secret);
});

test('coach certificate expired by date: "Expired" and "Valid until"', async ({ page }) => {
	const { token } = await certificate({ kind: 'trainer', expires: '2026-04-01T10:00:00Z' });
	await page.goto(`/certificate/${token}`);
	const main = page.locator('main');
	await expect(main.getByRole('status')).toHaveText('Expired');
	await expect(main.getByText('Coach certificate')).toBeVisible();
	await expect(main.getByText('Valid until')).toBeVisible();
	await expect(main.getByText('April 1, 2026')).toBeVisible();
});

test('revoked, in Russian: «Отозван», the reason is not shown', async ({ page }) => {
	const reason = `Hidden reason ${TAG}`;
	const { token } = await certificate({
		kind: 'judge',
		status: 'revoked',
		expires: '2028-03-05T10:00:00Z',
		reason
	});
	await page.goto(`/ru/certificate/${token}`);
	const main = page.locator('main');
	await expect(main.getByRole('heading', { level: 1 })).toHaveText('Проверка сертификата');
	await expect(main.getByRole('status')).toHaveText('Отозван');
	await expect(main.getByText('Сертификат судьи')).toBeVisible();
	expect(await page.content()).not.toContain(reason);
});
