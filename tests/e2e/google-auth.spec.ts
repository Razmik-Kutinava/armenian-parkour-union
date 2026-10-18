import { existsSync } from 'node:fs';
import { expect, test, type Page } from '@playwright/test';
import postgres from 'postgres';

if (!process.env.DATABASE_URL && existsSync('.env')) process.loadEnvFile('.env');
const sql = postgres(process.env.DATABASE_URL ?? '', { max: 1, onnotice: () => {} });
test.afterAll(() => sql.end());

test.beforeEach(async () => {
	await sql`delete from rate_limit where key ~ ':ip:(127\.0\.0\.1|::1|::ffff:127\.0\.0\.1)$'`;
});

const PASSWORD = 'parkour-pass-1';
const newEmail = () => `e2e-${crypto.randomUUID()}@example.com`;

async function register(page: Page, email: string) {
	await page.goto('/register');
	await page.getByLabel('Email').fill(email);
	await page.getByLabel('Password').fill(PASSWORD);
	await page.getByLabel('First name').fill('Test');
	await page.getByLabel('Last name').fill('Runner');
	await page.getByLabel('Date of birth').fill('1995-04-20');
	await page.getByLabel(/privacy policy/).check();
	await page.getByRole('button', { name: 'Create account' }).click();
	await expect(page).toHaveURL('/');
}

/** What a first Google sign-in leaves: a Google account and no consent yet. */
async function asFreshGoogleUser(email: string) {
	const [user] = await sql`
		update users set terms_accepted_at = null, birth_date = null
		where email = ${email} returning id`;
	await sql`
		insert into account (id, user_id, account_id, provider_id, created_at, updated_at)
		values (gen_random_uuid(), ${user.id}, ${'g-' + crypto.randomUUID()}, 'google', now(), now())`;
}

for (const path of ['/login', '/register']) {
	test(`${path}: "Continue with Google" leads to Google with our callback`, async ({ page }) => {
		await page.route('https://accounts.google.com/**', (route) =>
			route.fulfill({ contentType: 'text/html', body: '<p>google</p>' })
		);
		await page.goto(path);
		const google = page.waitForRequest(/^https:\/\/accounts\.google\.com\//);
		await page.getByRole('button', { name: 'Continue with Google' }).click();
		const target = new URL((await google).url());
		expect(new URL(target.searchParams.get('redirect_uri') ?? '').pathname).toBe(
			'/api/auth/callback/google'
		);
		expect(target.searchParams.get('state')).toBeTruthy();
	});
}

test('broken Google callback ends on the login page with a message', async ({ page }) => {
	await page.goto('/api/auth/callback/google?code=x');
	await expect(page).toHaveURL(/\/login\?error=/);
	await expect(page.getByText('Could not sign in with Google')).toBeVisible();
});

test('blocked account error from Google is shown, the raw code is not', async ({ page }) => {
	await page.goto('/login?error=ACCOUNT_BLOCKED');
	await expect(page.getByText('This account is blocked')).toBeVisible();
	await page.goto('/login?error=%3Cb%3Ehi%3C%2Fb%3E');
	await expect(page.getByText('Could not sign in with Google')).toBeVisible();
	await expect(page.getByText('<b>hi</b>')).toHaveCount(0);
});

test('new Google user must complete the profile before using the site', async ({ page }) => {
	const email = newEmail();
	await register(page, email);
	await asFreshGoogleUser(email);

	for (const path of ['/', '/events', '/ru/news', '/admin']) {
		await page.goto(path);
		await expect(page).toHaveURL(
			path.startsWith('/ru') ? '/ru/complete-profile' : '/complete-profile'
		);
	}
	await page.goto('/logout');
	await expect(page.getByRole('button', { name: 'Log out' })).toBeVisible();

	await page.goto('/complete-profile');
	await page.getByLabel('Date of birth').fill('2012-06-01');
	await page.getByRole('button', { name: 'Save and continue' }).click();
	await expect(page.getByLabel('Parent or guardian name')).toHaveAttribute('aria-invalid', 'true');
	await expect(page.getByText('You need to accept')).toBeVisible();

	await page.getByLabel('Parent or guardian name').fill('Parent Name');
	await page.getByLabel('Parent or guardian phone').fill('+374 91 123456');
	await page.getByLabel('Parent or guardian email').fill('parent@example.com');
	await page.getByLabel(/privacy policy/).check();
	await page.getByRole('button', { name: 'Save and continue' }).click();
	await expect(page).toHaveURL('/');

	await page.goto('/events');
	await expect(page).toHaveURL('/events');
	const [row] = await sql`
		select terms_accepted_at, birth_date::text as birth, guardian_name from users
		where email = ${email}`;
	expect(row.terms_accepted_at).not.toBeNull();
	expect(row.birth).toBe('2012-06-01');
	expect(row.guardian_name).toBe('Parent Name');
});

test('profile form is for signed-in users who need it only', async ({ page }) => {
	await page.goto('/complete-profile');
	await expect(page).toHaveURL(/\/login/);
	await register(page, newEmail());
	await page.goto('/complete-profile');
	await expect(page).toHaveURL('/');
});
