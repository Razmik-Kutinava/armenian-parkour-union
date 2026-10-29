import { createHmac } from 'node:crypto';
import { existsSync } from 'node:fs';
import { expect, test, type Browser, type Page } from '@playwright/test';
import postgres from 'postgres';

/* docs/06 sections 2, 5.1, 5.2, 5.9: overview, profile, payments and receipts, the status banner;
 * docs/04 section 5.3: own data only — another member's receipt is 404. */

if (!process.env.DATABASE_URL && existsSync('.env')) process.loadEnvFile('.env');
const sql = postgres(process.env.DATABASE_URL ?? '', { max: 1, onnotice: () => {} });
test.afterAll(() => sql.end());

/* Only sign-up counters: auth.spec.ts runs in parallel and checks the sign-in limit. */
test.beforeEach(async () => {
	await sql`delete from rate_limit where key ~ '^sign-up:ip:(127\.0\.0\.1|::1|::ffff:127\.0\.0\.1)$'`;
});

const PASSWORD = 'parkour-pass-1';

async function register(page: Page): Promise<{ id: string; email: string }> {
	const email = `e2e-cabinet-${crypto.randomUUID()}@example.com`;
	await page.goto('/register');
	await page.getByLabel('Email').fill(email);
	await page.getByLabel('Password').fill(PASSWORD);
	await page.getByLabel('First name').fill('Cabinet');
	await page.getByLabel('Last name').fill('Owner');
	await page.getByLabel('Date of birth').fill('1990-01-01');
	await page.getByLabel(/privacy policy/).check();
	await page.getByRole('button', { name: 'Create account' }).click();
	await expect(page).toHaveURL('/cabinet');
	const [user] = await sql`select id from users where email = ${email}`;
	return { id: user.id as string, email };
}

/* The sign-in limit is per address, and the "sixth attempt" test in auth.spec.ts may hold it for
 * this one address up to a minute (fixed window): try again until it frees. */
async function logIn(browser: Browser, email: string): Promise<Page> {
	const page = await (await browser.newContext()).newPage();
	await expect(async () => {
		await page.goto('/login');
		await page.getByLabel('Email').fill(email);
		await page.getByLabel('Password').fill(PASSWORD);
		await page.getByRole('button', { name: 'Log in' }).click();
		await expect(page).toHaveURL('/cabinet', { timeout: 5_000 });
	}).toPass({ intervals: [1_000, 5_000], timeout: 75_000 });
	return page;
}

test('guest: every cabinet page sends to log in and back', async ({ page }) => {
	for (const path of [
		'/cabinet',
		'/cabinet/profile',
		'/cabinet/events',
		'/cabinet/payments',
		'/cabinet/documents'
	]) {
		await page.goto(path);
		await expect(page).toHaveURL(`/login?returnTo=${encodeURIComponent(path)}`);
	}
	await page.goto(`/cabinet/payments/${crypto.randomUUID()}`);
	await expect(page).toHaveURL(/^.*\/login\?returnTo=%2Fcabinet%2Fpayments%2F/);
});

test('new account: overview, "confirm email" banner and resend', async ({ page }) => {
	await register(page);
	await expect(page.getByText('Confirm your email to pay the fee')).toBeVisible();

	await page.goto('/cabinet');
	const main = page.locator('main');
	await expect(main.getByRole('heading', { name: 'Hello, Cabinet!' })).toBeVisible();
	await expect(main.getByText('Not a member of the federation yet')).toBeVisible();
	await expect(main.getByRole('link', { name: 'Join' })).toHaveAttribute(
		'href',
		'/cabinet/membership'
	);
	const nav = page.getByRole('navigation', { name: 'Cabinet' });
	for (const name of ['Overview', 'Profile', 'Membership', 'Payments']) {
		await expect(nav.getByRole('link', { name })).toBeVisible();
	}
	await main.getByRole('button', { name: 'Send the letter again' }).click();
	await expect(main.getByText('We have sent the letter again')).toBeVisible();
});

test('membership ends soon: banner with the date and "Renew"', async ({ page }) => {
	const user = await register(page);
	await sql`update users set email_verified = true, level = 'novice' where id = ${user.id}`;
	await sql`insert into memberships (user_id, status, starts_at, ends_at)
		values (${user.id}, 'active', now() - interval '355 days', now() + interval '10 days')`;
	await page.goto('/news');
	await expect(page.getByText(/Your membership ends on/)).toBeVisible();
	await expect(page.getByRole('link', { name: 'Renew' }).first()).toHaveAttribute(
		'href',
		'/cabinet/membership'
	);
	await expect(page.getByText('Confirm your email to pay the fee')).toHaveCount(0);

	await page.goto('/cabinet');
	await expect(page.locator('main').getByText('Level: Novice')).toBeVisible();
	await expect(page.locator('main').getByText(/Your membership ends soon/)).toBeVisible();
});

test('profile: save the fields; birth date is shown, not edited', async ({ page }) => {
	const user = await register(page);
	await page.goto('/cabinet/profile');
	const main = page.locator('main');
	await expect(
		main.getByText('To change the date of birth, contact the federation.')
	).toBeVisible();
	await expect(main.locator('input[name="birthDate"]')).toHaveCount(0);
	await main.getByLabel('City', { exact: true }).fill('Gyumri');
	await main.getByLabel('About me').fill('Traceur from Gyumri');
	await main.getByLabel('Phone').fill('+374 91 123456');
	await main.getByRole('button', { name: 'Save', exact: true }).click();
	await expect(main.getByText('Profile saved.')).toBeVisible();
	const [row] =
		await sql`select city, bio, phone, birth_date::text as birth from users where id = ${user.id}`;
	expect(row).toEqual({
		city: 'Gyumri',
		bio: 'Traceur from Gyumri',
		phone: '+374 91 123456',
		birth: '1990-01-01'
	});

	await main.getByLabel('New email').fill('cabinet-new@example.com');
	await main.getByRole('button', { name: 'Change email' }).click();
	await expect(
		main.getByText(/We have sent a confirmation link to cabinet-new@example.com/)
	).toBeVisible();
	const [after] = await sql`select email from users where id = ${user.id}`;
	expect(after.email).toBe(user.email);
});

/** The token Better Auth mails to the new address (HS256 with the auth secret, as in its signJWT). */
function changeToken(email: string, updateTo: string, secret: string): string {
	const part = (v: object) => Buffer.from(JSON.stringify(v)).toString('base64url');
	const now = Math.floor(Date.now() / 1000);
	const body = `${part({ alg: 'HS256' })}.${part({ email, updateTo, requestType: 'change-email-verification', iat: now, exp: now + 600 })}`;
	return `${body}.${createHmac('sha256', secret).update(body).digest('base64url')}`;
}

test('email change link: a forged token changes nothing, the real one switches the email', async ({
	page
}) => {
	const user = await register(page);
	const next = `e2e-cabinet-new-${crypto.randomUUID()}@example.com`;
	const forged = await page.goto(`/verify-email?token=${changeToken(user.email, next, 'wrong')}`);
	expect(forged?.status()).toBe(400);
	expect((await sql`select email from users where id = ${user.id}`)[0].email).toBe(user.email);

	const secret = process.env.BETTER_AUTH_SECRET ?? '';
	await page.goto(`/verify-email?token=${changeToken(user.email, next, secret)}`);
	const [row] = await sql`select email, email_verified from users where id = ${user.id}`;
	expect(row).toEqual({ email: next, email_verified: true });
});

test('password change: wrong current is refused; success signs out other devices', async ({
	page,
	browser
}) => {
	test.setTimeout(120_000);
	const user = await register(page);
	const other = await logIn(browser, user.email);

	await page.goto('/cabinet/profile');
	const main = page.locator('main');
	await main.getByLabel('Current password').fill('wrong-password');
	await main.getByLabel('New password').fill('brand-new-pass-2');
	await main.getByRole('button', { name: 'Change password' }).click();
	await expect(main.getByText('Wrong current password.')).toBeVisible();

	await main.getByLabel('Current password').fill(PASSWORD);
	await main.getByLabel('New password').fill('brand-new-pass-2');
	await main.getByRole('button', { name: 'Change password' }).click();
	await expect(main.getByText(/Password changed/)).toBeVisible();

	await page.goto('/cabinet');
	await expect(page).toHaveURL('/cabinet');
	await other.goto('/cabinet');
	await expect(other).toHaveURL('/login?returnTo=%2Fcabinet');
	await other.context().close();
});

test('payments: own list, receipt of a paid one, another member’s receipt is 404', async ({
	page
}) => {
	const user = await register(page);
	const [paid] = await sql`insert into payments (user_id, kind, status, amount_minor, currency,
		provider, paid_at) values (${user.id}, 'donation', 'paid', 7000, 'AMD', 'manual', now())
		returning id`;
	await sql`insert into payments (user_id, kind, status, amount_minor, currency, provider)
		values (${user.id}, 'membership', 'failed', 20000, 'AMD', 'manual')`;
	const [foreign] = await sql`insert into payments (user_id, kind, status, amount_minor, currency,
		provider, paid_at, donor_name) values (null, 'donation', 'paid', 9000, 'AMD', 'manual', now(),
		'Someone Else') returning id`;

	await page.goto('/cabinet/payments');
	const main = page.locator('main');
	await expect(main.getByRole('row')).toHaveCount(3);
	await expect(main.getByText('Failed')).toBeVisible();
	await main.getByRole('link', { name: 'Receipt' }).click();
	await expect(page).toHaveURL(`/cabinet/payments/${paid.id}`);
	await expect(main.getByText(paid.id as string)).toBeVisible();
	await expect(main.getByText('General needs of the federation')).toBeVisible();
	await expect(main.getByText('Cabinet Owner')).toBeVisible();

	const res = await page.goto(`/cabinet/payments/${foreign.id}`);
	expect(res?.status()).toBe(404);
	expect((await page.goto('/cabinet/payments/not-a-uuid'))?.status()).toBe(404);
});
