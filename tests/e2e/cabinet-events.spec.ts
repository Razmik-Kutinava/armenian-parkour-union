import { existsSync } from 'node:fs';
import { expect, test, type Page } from '@playwright/test';
import postgres from 'postgres';
import { hydrated } from './hydrated';

/* docs/06 section 5.4: "My events" — upcoming with "Cancel", past with place and score. Which
 * rows and buttons show is tested in services/cabinet/events; here — what the member sees. */

if (!process.env.DATABASE_URL && existsSync('.env')) process.loadEnvFile('.env');
const sql = postgres(process.env.DATABASE_URL ?? '', { max: 1, onnotice: () => {} });
test.afterAll(() => sql.end());

test.beforeEach(async () => {
	await sql`delete from rate_limit where key ~ '^sign-up:ip:(127\.0\.0\.1|::1|::ffff:127\.0\.0\.1)$'`;
});

async function signUp(page: Page): Promise<string> {
	const email = `e2e-myevents-${crypto.randomUUID()}@example.com`;
	await page.goto('/register');
	await page.getByLabel('Email').fill(email);
	await page.getByLabel('Password').fill('parkour-pass-1');
	await page.getByLabel('First name').fill('My');
	await page.getByLabel('Last name').fill('Events');
	await page.getByLabel('Date of birth').fill('1990-01-01');
	await page.getByLabel(/privacy policy/).check();
	await page.getByRole('button', { name: 'Create account' }).click();
	await expect(page).toHaveURL('/cabinet');
	const [user] = await sql`select id from users where email = ${email}`;
	return user.id as string;
}

async function insertEvent(title: string, startsInDays: number) {
	const slug = `e2e-myevents-${crypto.randomUUID().slice(0, 8)}`;
	const [row] = await sql`
		insert into events (slug, title, status, published_at, starts_at, ends_at)
		values (${slug}, ${sql.json({ en: title })}, 'published', now() - interval '40 days',
			now() + make_interval(days => ${startsInDays}),
			now() + make_interval(days => ${startsInDays}) + interval '2 hours')
		returning id`;
	return { id: row.id as string, slug };
}

test('upcoming with "Cancel", past with the place and score', async ({ page }) => {
	const id = await signUp(page);
	const tag = crypto.randomUUID().slice(0, 6);
	const coming = await insertEvent(`Coming jam ${tag}`, 10);
	const done = await insertEvent(`Past cup ${tag}`, -10);
	await sql`insert into event_registrations (event_id, user_id, status)
		values (${coming.id}, ${id}, 'registered')`;
	await sql`insert into event_registrations (event_id, user_id, status, place, score)
		values (${done.id}, ${id}, 'attended', 2, 71.25)`;

	await page.goto('/cabinet/events');
	await hydrated(page);
	const upcoming = page.getByRole('listitem').filter({ hasText: `Coming jam ${tag}` });
	await expect(upcoming.getByText('Registered')).toBeVisible();
	await expect(upcoming.getByRole('link', { name: `Coming jam ${tag}` })).toHaveAttribute(
		'href',
		`/events/${coming.slug}`
	);
	await expect(page.getByText(`Past cup ${tag}`)).toHaveCount(0);

	await upcoming.getByRole('button', { name: 'Cancel registration' }).click();
	await expect(page.getByText('Registration cancelled.')).toBeVisible();
	const [row] = await sql`select status from event_registrations
		where event_id = ${coming.id} and user_id = ${id}`;
	expect(row.status).toBe('cancelled');

	await page.getByRole('link', { name: 'Past' }).click();
	await expect(page).toHaveURL('/cabinet/events?tab=past');
	const past = page.getByRole('listitem').filter({ hasText: `Past cup ${tag}` });
	await expect(past.getByText('Place: 2')).toBeVisible();
	await expect(past.getByText('Score: 71.25')).toBeVisible();
	await expect(past.getByText('Points: 0')).toBeVisible();
});

test('another member’s event cannot be cancelled from the cabinet', async ({ page, browser }) => {
	const mine = await signUp(page);
	const other = await (await browser.newContext()).newPage();
	const theirs = await signUp(other);
	const event = await insertEvent(`Theirs ${crypto.randomUUID().slice(0, 6)}`, 10);
	await sql`insert into event_registrations (event_id, user_id, status)
		values (${event.id}, ${theirs}, 'registered')`;
	expect(mine).not.toBe(theirs);

	await page.goto('/cabinet/events');
	await expect(page.getByText('No upcoming events.')).toBeVisible();
	const res = await page.request.post('/cabinet/events?/cancel', {
		form: { eventId: event.id },
		headers: { origin: new URL(page.url()).origin }
	});
	expect(res.status()).toBeLessThan(500);
	const [row] = await sql`select status from event_registrations
		where event_id = ${event.id} and user_id = ${theirs}`;
	expect(row.status).toBe('registered');
});
