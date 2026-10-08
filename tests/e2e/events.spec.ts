import { existsSync } from 'node:fs';
import { expect, test, type Page } from '@playwright/test';
import postgres from 'postgres';

if (!process.env.DATABASE_URL && existsSync('.env')) process.loadEnvFile('.env');
const sql = postgres(process.env.DATABASE_URL ?? '', { max: 1, onnotice: () => {} });
test.afterAll(() => sql.end());
/* Only sign-up counters: auth.spec.ts runs in parallel and checks the sign-in limit. */
test.beforeEach(async () => {
	await sql`delete from rate_limit where key ~ '^sign-up:ip:(127\.0\.0\.1|::1|::ffff:127\.0\.0\.1)$'`;
});

async function registerAs(page: Page, role: 'editor' | 'admin') {
	const email = `e2e-events-${role}-${crypto.randomUUID()}@example.com`;
	await page.goto('/register');
	await page.getByLabel('Email').fill(email);
	await page.getByLabel('Password').fill('parkour-pass-1');
	await page.getByLabel('First name').fill('Events');
	await page.getByLabel('Last name').fill(role);
	await page.getByLabel('Date of birth').fill('1990-01-01');
	await page.getByLabel(/privacy policy/).check();
	await page.getByRole('button', { name: 'Create account' }).click();
	await expect(page).toHaveURL('/');
	await sql`update users set role = ${role} where email = ${email}`;
}

const meta = (page: Page, key: string) =>
	page.locator(`meta[property="${key}"], meta[name="${key}"]`).first().getAttribute('content');

test('editor creates an event with a category, previews, publishes; guest finds and reads it', async ({
	page,
	browser
}) => {
	test.setTimeout(120_000);
	await registerAs(page, 'editor');
	const guest = await (await browser.newContext()).newPage();
	const slug = `e2e-event-${crypto.randomUUID().slice(0, 8)}`;
	const city = `E2e ${crypto.randomUUID().slice(0, 6)}`;

	await page.goto('/admin/events');
	await page.getByRole('link', { name: 'New event' }).click();
	await expect(page).toHaveURL('/admin/events/new');
	await page.getByLabel('Page address').fill(slug);
	await page.getByLabel('Title (English)').fill('Autumn jam');
	await page.getByRole('textbox', { name: 'Description (English)' }).click();
	await page.keyboard.type('Bring water and good shoes');
	await page.getByLabel('Starts').fill('2099-05-01T11:00');
	await page.getByLabel('Ends').fill('2099-05-01T18:00');
	await page.getByLabel('Venue').fill('Parkour park');
	await page.getByLabel('City').fill(city);
	await page.getByLabel('Price').fill('5000');
	await page.getByLabel('Participant limit').fill('40');
	await page.getByRole('button', { name: 'Save' }).click();
	await expect(page).toHaveURL(/\/admin\/events\/[0-9a-f-]{36}$/);
	const [row] = await sql`
		select id, status, price_amount_minor, price_currency, capacity, created_by
		from events where slug = ${slug}`;
	expect(row).toMatchObject({
		status: 'draft',
		price_amount_minor: 5000,
		price_currency: 'AMD',
		capacity: 40
	});
	expect(row.created_by).not.toBeNull();

	await page.getByLabel('Category name (English)').fill('Speed, 12–14');
	await page.getByLabel('Discipline').selectOption('speed');
	await page.getByLabel('Age from').fill('12');
	await page.getByLabel('Age to').fill('14');
	await page.getByRole('button', { name: 'Add category' }).click();
	await expect(page.getByText('Speed, 12–14')).toBeVisible();
	const categories =
		await sql`select discipline, age_min, age_max from event_categories where event_id = ${row.id}`;
	expect(categories).toEqual([{ discipline: 'speed', age_min: 12, age_max: 14 }]);

	expect((await guest.goto(`/events/${slug}`))?.status()).toBe(404);
	const preview = await page.request.get(`/admin/events/${row.id}/preview`);
	expect(preview.status()).toBe(200);
	expect(await preview.text()).toContain('Bring water and good shoes');
	expect(
		(await guest.request.get(`/admin/events/${row.id}/preview`, { maxRedirects: 0 })).status()
	).toBe(303);
	await expect(page.getByRole('button', { name: 'Cancel event' })).toHaveCount(0);
	await expect(page.getByRole('button', { name: 'Archive' })).toHaveCount(0);

	await page.getByRole('button', { name: 'Publish' }).click();
	await expect(page.getByRole('button', { name: 'Unpublish' })).toBeVisible();

	await guest.goto(`/events?city=${encodeURIComponent(city)}&discipline=speed`);
	await guest.getByRole('link', { name: 'Autumn jam' }).click();
	await expect(guest).toHaveURL(`/events/${slug}`);
	await expect(guest.getByRole('heading', { level: 1, name: 'Autumn jam' })).toBeVisible();
	await expect(guest.getByText('Bring water and good shoes')).toBeVisible();
	await expect(guest.getByText('Speed, 12–14')).toBeVisible();
	await expect(guest.getByRole('button', { name: 'Register' })).toBeDisabled();
	await expect(guest.getByRole('link', { name: 'Open on the map' })).toHaveAttribute(
		'href',
		/google\.com\/maps/
	);
	expect(await meta(guest, 'og:title')).toBe('Autumn jam');
	const ld = JSON.parse((await guest.locator('script[type="application/ld+json"]').textContent())!);
	expect(ld).toMatchObject({ '@type': 'Event', name: 'Autumn jam' });
	await guest.goto(`/events?city=${encodeURIComponent(city)}&discipline=tricking`);
	await expect(guest.getByRole('link', { name: 'Autumn jam' })).toHaveCount(0);

	await page.getByRole('button', { name: 'Duplicate' }).click();
	await expect(page).toHaveURL(/\/admin\/events\/[0-9a-f-]{36}$/);
	await expect(page.getByLabel('Page address')).toHaveValue(`${slug}-copy`);
	const [copy] =
		await sql`select id, status, published_at from events where slug = ${`${slug}-copy`}`;
	expect(copy).toMatchObject({ status: 'draft', published_at: null });
	expect(await sql`select 1 from event_categories where event_id = ${copy.id}`).toHaveLength(1);

	await page.getByRole('button', { name: 'Delete' }).click();
	await page.getByRole('dialog').getByRole('button', { name: 'Delete' }).click();
	await expect(page).toHaveURL('/admin/events');
	expect(
		(await sql`select deleted_at from events where id = ${copy.id}`)[0].deleted_at
	).not.toBeNull();
});

test('admin cancels with a reason and finishes a past event; guest sees the archive', async ({
	page,
	browser
}) => {
	test.setTimeout(90_000);
	await registerAs(page, 'admin');
	const guest = await (await browser.newContext()).newPage();
	const city = `E2e ${crypto.randomUUID().slice(0, 6)}`;
	const insert = (slug: string, title: string, startsAgo: string, endsAgo: string) => sql`
		insert into events (slug, title, status, published_at, starts_at, ends_at, city)
		values (${slug}, ${sql.json({ en: title })}, 'published', now() - interval '3 days',
			now() - ${startsAgo}::interval, now() - ${endsAgo}::interval, ${city})
		returning id`;
	const cancelSlug = `e2e-event-${crypto.randomUUID().slice(0, 8)}`;
	const pastSlug = `e2e-event-${crypto.randomUUID().slice(0, 8)}`;
	const [toCancel] = await insert(cancelSlug, 'Rainy jam', '-10 days', '-11 days');
	const [past] = await insert(pastSlug, 'Summer cup', '1 hour', '1 minute');

	await page.goto(`/admin/events/${toCancel.id}`);
	await page.getByRole('button', { name: 'Cancel event' }).click();
	await page.getByRole('dialog').getByLabel('Comment (required)').fill('Storm warning');
	await page.getByRole('dialog').getByRole('button', { name: 'Cancel event' }).click();
	await expect(page.getByText('Cancelled', { exact: true })).toBeVisible();
	const [entry] =
		await sql`select after from audit_log where entity_id = ${toCancel.id} and action = 'event.cancel'`;
	expect(entry.after).toMatchObject({ status: 'cancelled', reason: 'Storm warning' });

	await guest.goto(`/events?city=${encodeURIComponent(city)}`);
	await expect(guest.getByRole('link', { name: 'Rainy jam' })).toHaveCount(0);
	expect((await guest.goto(`/events/${cancelSlug}`))?.status()).toBe(200);
	await expect(guest.getByText('This event is cancelled')).toBeVisible();

	await page.goto(`/admin/events/${past.id}`);
	await page.getByRole('button', { name: 'Finish' }).click();
	await expect(page.getByText('Finished', { exact: true })).toBeVisible();
	await guest.goto('/events/archive');
	await expect(guest.getByRole('link', { name: 'Summer cup' })).toBeVisible();

	await page.getByRole('button', { name: 'Archive' }).click();
	await expect(page.getByRole('button', { name: 'Return to drafts' })).toBeVisible();
	expect((await guest.goto(`/events/${pastSlug}`))?.status()).toBe(404);
});

test('the events list and archive answer in every language and are in the site menu', async ({
	page
}) => {
	for (const path of [
		'/events',
		'/hy/events',
		'/ru/events',
		'/events/archive',
		'/ru/events/archive'
	]) {
		expect((await page.goto(path))?.status(), path).toBe(200);
	}
	await page.goto('/events');
	await expect(page.getByRole('link', { name: 'Archive' })).toHaveAttribute(
		'href',
		'/events/archive'
	);
	await page.goto('/');
	await expect(
		page.getByRole('navigation').getByRole('link', { name: 'Events' }).first()
	).toHaveAttribute('href', '/events');
});
