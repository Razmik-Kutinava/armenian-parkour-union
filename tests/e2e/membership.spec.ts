import { existsSync } from 'node:fs';
import { expect, test, type Page } from '@playwright/test';
import postgres from 'postgres';
import { openPaymentSettings, registerAdmin } from './payment-settings-form';

/* docs/06 sections 4.9, 5.3: /join by three states, the cabinet page, the pay button refusals.
 * The e2e server is a production build: no mock provider, `/dev/*` is 404. */

if (!process.env.DATABASE_URL && existsSync('.env')) process.loadEnvFile('.env');
const sql = postgres(process.env.DATABASE_URL ?? '', { max: 1, onnotice: () => {} });

const FEE = { amount_minor: 20_000, currency: 'AMD', period_months: 12 };
let savedFee: unknown = undefined;

test.describe.configure({ mode: 'serial' });

test.beforeAll(async () => {
	const [row] = await sql`select value from site_settings where key = 'membership_fee'`;
	savedFee = row?.value;
	await sql`insert into site_settings (key, value) values ('membership_fee', ${sql.json(FEE)})
		on conflict (key) do update set value = excluded.value`;
});

test.afterAll(async () => {
	if (savedFee === undefined) await sql`delete from site_settings where key = 'membership_fee'`;
	else
		await sql`update site_settings set value = ${sql.json(savedFee as never)} where key = 'membership_fee'`;
	await sql.end();
});

test.beforeEach(async () => {
	await sql`delete from rate_limit where key ~ '^sign-up:ip:(127\.0\.0\.1|::1|::ffff:127\.0\.0\.1)$'`;
});

async function register(page: Page): Promise<string> {
	const email = `e2e-membership-${crypto.randomUUID()}@example.com`;
	await page.goto('/register');
	await page.getByLabel('Email').fill(email);
	await page.getByLabel('Password').fill('parkour-pass-1');
	await page.getByLabel('First name').fill('Member');
	await page.getByLabel('Last name').fill('Fee');
	await page.getByLabel('Date of birth').fill('1990-01-01');
	await page.getByLabel(/privacy policy/).check();
	await page.getByRole('button', { name: 'Create account' }).click();
	await expect(page).toHaveURL('/');
	const [user] = await sql`select id from users where email = ${email}`;
	return user.id as string;
}

test('guest: cabinet sends to log in and back', async ({ page }) => {
	await page.goto('/cabinet/membership');
	await expect(page).toHaveURL('/login?returnTo=%2Fcabinet%2Fmembership');
	await page.goto('/ru/cabinet/membership');
	await expect(page).toHaveURL(/returnTo=%2Fru%2Fcabinet%2Fmembership$/);
});

test('guest: /join shows the fee and offers to sign up or log in, no pay button', async ({
	page
}) => {
	const response = await page.goto('/join');
	expect(response?.status()).toBe(200);
	const main = page.locator('main');
	await expect(main.getByRole('heading', { name: 'Membership fee', exact: true })).toBeVisible();
	await expect(main.getByText(/20,000/)).toBeVisible();
	await expect(main.getByText(/12 months/)).toBeVisible();
	await expect(main.getByRole('link', { name: 'Create an account' })).toHaveAttribute(
		'href',
		'/register'
	);
	await expect(main.getByRole('link', { name: 'Log in' })).toHaveAttribute(
		'href',
		'/login?returnTo=%2Fjoin'
	);
	await expect(main.getByRole('button', { name: 'Pay the fee' })).toHaveCount(0);
});

test('/pages/join leads to /join', async ({ page }) => {
	await page.goto('/ru/pages/join');
	await expect(page).toHaveURL('/ru/join');
});

test('member: email not confirmed, then online payment off — clear messages', async ({ page }) => {
	const userId = await register(page);
	await page.goto('/join');
	const main = page.locator('main');
	await main.getByRole('button', { name: 'Pay the fee' }).click();
	await expect(main.getByText(/Confirm your email/)).toBeVisible();

	await sql`update users set email_verified = true where id = ${userId}`;
	await page.goto('/cabinet/membership');
	await expect(page.getByRole('heading', { name: 'Membership', exact: true })).toBeVisible();
	await expect(main.getByText('No active membership')).toBeVisible();
	await main.getByRole('button', { name: 'Pay the fee' }).click();
	await expect(main.getByText(/not available right now/)).toBeVisible();
	const [{ count }] = await sql`select count(*)::int from payments where user_id = ${userId}`;
	expect(count).toBe(0);
});

test('member with an active membership: "already a member" and the period in the cabinet', async ({
	page
}) => {
	const userId = await register(page);
	await sql`insert into memberships (user_id, status, starts_at, ends_at)
		values (${userId}, 'active', now() - interval '10 days', now() + interval '355 days')`;
	await page.goto('/join');
	const main = page.locator('main');
	await expect(main.getByText('You are already a member of the federation.')).toBeVisible();
	await expect(main.getByRole('link', { name: 'My membership' })).toHaveAttribute(
		'href',
		'/cabinet/membership'
	);
	await expect(main.getByRole('button', { name: 'Pay the fee' })).toHaveCount(0);

	await page.goto('/cabinet/membership');
	await expect(main.getByText(/Active until/)).toBeVisible();
	await expect(main.getByRole('button', { name: 'Renew membership' })).toBeVisible();
	await expect(main.getByRole('heading', { name: 'History' })).toBeVisible();
});

test('dev mock checkout is not served in production', async ({ request }) => {
	const res = await request.get('/dev/mock-pay/mock_anything', { maxRedirects: 0 });
	expect(res.status()).toBe(404);
	const post = await request.post('/dev/mock-pay/mock_anything?/settle', {
		form: { status: 'paid' },
		headers: { origin: 'http://localhost:4173' },
		maxRedirects: 0
	});
	expect(post.status()).toBe(404);
});

/* Last in the file: changes the fee the tests above rely on; afterAll restores it. */
test('admin: a new fee and term in the settings show on /join at once (docs/05 section 21)', async ({
	page
}) => {
	const adminId = await registerAdmin(page, sql, 'Fee');
	await openPaymentSettings(page);
	await expect(page.getByLabel('Membership fee amount')).toHaveValue('20000');
	await page.getByLabel('Membership fee amount').fill('25000');
	await page.getByLabel('Term, months').fill('6');
	await page.getByRole('button', { name: 'Save' }).click();
	await expect(page.getByText('Saved.')).toBeVisible();

	const [log] = await sql`
		select before, after from audit_log
		where actor_id = ${adminId} and action = 'settings.update' and after ? 'membership_fee'`;
	expect(log.before).toEqual({ membership_fee: FEE });
	expect(log.after).toEqual({
		membership_fee: { amount_minor: 25_000, currency: 'AMD', period_months: 6 }
	});
	await page.goto('/join');
	const main = page.locator('main');
	await expect(main.getByText(/25,000/)).toBeVisible();
	await expect(main.getByText(/6 months/)).toBeVisible();
});
