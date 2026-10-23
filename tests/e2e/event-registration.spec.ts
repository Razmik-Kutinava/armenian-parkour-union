import { existsSync } from 'node:fs';
import { expect, test, type Page } from '@playwright/test';
import postgres from 'postgres';
import { hydrated } from './hydrated';

/* docs/06 section 4.3: the registration block on the event page in each state. The rules
 * themselves are tested in services/registrations; here — what the member sees and presses.
 * The e2e server has no payment provider: online payment is off. */

if (!process.env.DATABASE_URL && existsSync('.env')) process.loadEnvFile('.env');
const sql = postgres(process.env.DATABASE_URL ?? '', { max: 1, onnotice: () => {} });
test.afterAll(() => sql.end());

test.beforeEach(async () => {
	await sql`delete from rate_limit where key ~ '^sign-up:ip:(127\.0\.0\.1|::1|::ffff:127\.0\.0\.1)$'`;
});

async function signUp(page: Page, prefix: string): Promise<string> {
	const email = `e2e-reg-${prefix}-${crypto.randomUUID()}@example.com`;
	await page.goto('/register');
	await page.getByLabel('Email').fill(email);
	await page.getByLabel('Password').fill('parkour-pass-1');
	await page.getByLabel('First name').fill('Reg');
	await page.getByLabel('Last name').fill(prefix);
	await page.getByLabel('Date of birth').fill('1990-01-01');
	await page.getByLabel(/privacy policy/).check();
	await page.getByRole('button', { name: 'Create account' }).click();
	await expect(page).toHaveURL('/cabinet');
	const [user] = await sql`select id from users where email = ${email}`;
	return user.id as string;
}

/** Verified email and a membership in force: admitted to a free event. */
async function makeMember(id: string) {
	await sql`update users set email_verified = true where id = ${id}`;
	await sql`insert into memberships (user_id, status, starts_at, ends_at)
		values (${id}, 'active', now() - interval '1 day', now() + interval '300 days')`;
}

async function insertEvent(extra: { capacity?: number; price?: number } = {}) {
	const slug = `e2e-reg-${crypto.randomUUID().slice(0, 8)}`;
	const [row] = await sql`
		insert into events (slug, title, status, published_at, starts_at, ends_at, capacity,
			price_amount_minor)
		values (${slug}, ${sql.json({ en: 'Registration jam' })}, 'published',
			now() - interval '1 day', now() + interval '10 days', now() + interval '10 days 2 hours',
			${extra.capacity ?? null}, ${extra.price ?? 0})
		returning id`;
	return { id: row.id as string, slug };
}

const statusOf = async (eventId: string, userId: string) =>
	(
		await sql`select status from event_registrations
			where event_id = ${eventId} and user_id = ${userId}`
	)[0]?.status;

test('a guest is asked to log in and comes back to the event', async ({ page }) => {
	const event = await insertEvent();
	await page.goto(`/events/${event.slug}`);
	await expect(page.getByRole('link', { name: 'Log in to register' })).toHaveAttribute(
		'href',
		`/login?returnTo=${encodeURIComponent(`/events/${event.slug}`)}`
	);
	await expect(page.getByRole('button', { name: 'Register' })).toHaveCount(0);
});

test('without a membership: the reason and the way to join', async ({ page }) => {
	const event = await insertEvent();
	const id = await signUp(page, 'nomember');
	await sql`update users set email_verified = true where id = ${id}`;
	await page.goto(`/events/${event.slug}`);
	await expect(page.getByText('Participation requires a membership.')).toBeVisible();
	await expect(page.getByRole('link', { name: 'Become a member' })).toHaveAttribute(
		'href',
		'/join'
	);
	await expect(page.getByRole('button', { name: 'Register' })).toHaveCount(0);
});

test('register, the waitlist when full, cancel — the first in line takes the place', async ({
	page,
	browser
}) => {
	test.setTimeout(120_000);
	const event = await insertEvent({ capacity: 1 });
	const first = await signUp(page, 'first');
	await makeMember(first);
	const other = await (await browser.newContext()).newPage();
	const second = await signUp(other, 'second');
	await makeMember(second);

	await page.goto(`/events/${event.slug}`);
	await hydrated(page);
	await page.getByRole('button', { name: 'Register' }).click();
	await expect(page.getByText('You are registered.')).toBeVisible();
	expect(await statusOf(event.id, first)).toBe('registered');

	await other.goto(`/events/${event.slug}`);
	await hydrated(other);
	await expect(other.getByText(/No places left/)).toBeVisible();
	await other.getByRole('button', { name: 'Join the waitlist' }).click();
	await expect(other.getByText('You are on the waitlist.')).toBeVisible();
	expect(await statusOf(event.id, second)).toBe('waitlist');

	await page.getByRole('button', { name: 'Cancel registration' }).click();
	await expect(page.getByText('Registration cancelled.')).toBeVisible();
	expect(await statusOf(event.id, first)).toBe('cancelled');
	await other.reload();
	await expect(other.getByText('You are registered.')).toBeVisible();
	expect(await statusOf(event.id, second)).toBe('registered');
});

test('a paid event while online payment is off: closed for new; a held place shows "Pay"', async ({
	page
}) => {
	const event = await insertEvent({ price: 5000 });
	const id = await signUp(page, 'payer');
	await makeMember(id);
	await page.goto(`/events/${event.slug}`);
	await expect(page.getByText(/registration for paid events is closed/)).toBeVisible();
	await expect(page.getByRole('button', { name: 'Register' })).toHaveCount(0);

	await sql`insert into event_registrations (event_id, user_id, status, hold_until)
		values (${event.id}, ${id}, 'pending_payment', now() + interval '20 minutes')`;
	await page.reload();
	await expect(page.getByText(/Your place is held until/)).toBeVisible();
	await hydrated(page);
	await page.getByRole('button', { name: 'Pay for participation' }).click();
	await expect(page.getByText('Online payment is not available right now.')).toBeVisible();
	expect(await statusOf(event.id, id)).toBe('pending_payment');
});
