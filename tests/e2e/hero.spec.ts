import { existsSync } from 'node:fs';
import { expect, test, type Page } from '@playwright/test';
import postgres from 'postgres';

if (!process.env.DATABASE_URL && existsSync('.env')) process.loadEnvFile('.env');
const sql = postgres(process.env.DATABASE_URL ?? '', { max: 1, onnotice: () => {} });

/* Blocks of this file are titled "E2e hero вЂ¦"; switched off and archived so the limit stays free. */
const cleanUp = () =>
	sql`update hero_blocks set is_active = false, archived_at = coalesce(archived_at, now())
		where title->>'en' like 'E2e hero%'`;
test.beforeAll(cleanUp);
test.afterAll(async () => {
	await cleanUp();
	await sql.end();
});
/* Only sign-up counters: auth.spec.ts runs in parallel and checks the sign-in limit. */
test.beforeEach(async () => {
	await sql`delete from rate_limit where key ~ '^sign-up:ip:(127\.0\.0\.1|::1|::ffff:127\.0\.0\.1)$'`;
});

async function registerAs(page: Page, role: 'editor' | 'member') {
	const email = `e2e-hero-${role}-${crypto.randomUUID()}@example.com`;
	await page.goto('/register');
	await page.getByLabel('Email').fill(email);
	await page.getByLabel('Password').fill('parkour-pass-1');
	await page.getByLabel('First name').fill('Hero');
	await page.getByLabel('Last name').fill(role);
	await page.getByLabel('Date of birth').fill('1990-01-01');
	await page.getByLabel(/privacy policy/).check();
	await page.getByRole('button', { name: 'Create account' }).click();
	/* The first sign-up of a run wakes the server and the database. */
	await expect(page).toHaveURL('/', { timeout: 15_000 });
	await sql`update users set role = ${role} where email = ${email}`;
}

const title = (what: string) => `E2e hero ${what} ${crypto.randomUUID().slice(0, 6)}`;
/** Other active blocks may exist in the dev database: put this one first on the home page. */
const putFirst = (id: string) => sql`update hero_blocks set sort_order = -1000 where id = ${id}`;
const rowByTitle = async (t: string) =>
	(await sql`select * from hero_blocks where title->>'en' = ${t} order by created_at limit 1`)[0];

test('editor creates a block, previews it, the guest sees it; off and archived it is gone', async ({
	page,
	browser
}) => {
	test.setTimeout(120_000);
	await registerAs(page, 'editor');
	const guest = await (await browser.newContext()).newPage();
	const heading = title('presentation');

	await page.goto('/admin/hero');
	await expect(page.getByRole('heading', { name: 'Now on the home page' })).toBeVisible();
	await page.getByRole('link', { name: 'New block' }).click();
	await expect(page).toHaveURL('/admin/hero/new');
	await page.getByLabel('Type').selectOption('presentation');
	await page.getByLabel('Title (English)', { exact: true }).fill(heading);
	await page.getByLabel('Subtitle (English)').fill('Parkour for everyone');
	await page.getByLabel('Button text (English)').fill('Train with us');
	await page.getByLabel('Button link').fill('/events');
	await page.getByLabel('Active').check();
	await page.getByRole('button', { name: 'Save' }).click();
	await expect(page).toHaveURL(/\/admin\/hero\/[0-9a-f-]{36}$/);
	const row = await rowByTitle(heading);
	expect(row).toMatchObject({
		type: 'presentation',
		subtitle: { en: 'Parkour for everyone' },
		cta_label: { en: 'Train with us' },
		cta_url: '/events',
		is_active: true,
		archived_at: null
	});
	expect(row.created_by).not.toBeNull();
	await putFirst(row.id);

	const preview = await page.request.get(`/admin/hero/${row.id}/preview`);
	expect(preview.status()).toBe(200);
	expect(await preview.text()).toContain(heading);
	expect(
		(await guest.request.get(`/admin/hero/${row.id}/preview`, { maxRedirects: 0 })).status()
	).toBe(303);

	await guest.goto('/');
	await expect(guest.getByRole('heading', { level: 1, name: heading })).toBeVisible();
	await expect(guest.getByText('Parkour for everyone')).toBeVisible();
	await expect(guest.getByRole('link', { name: 'Train with us' })).toHaveAttribute(
		'href',
		'/events'
	);
	await guest.goto('/ru');
	await expect(guest.getByRole('link', { name: 'Train with us' })).toHaveAttribute(
		'href',
		'/ru/events'
	);

	await page.goto('/admin/hero');
	const card = page.getByRole('listitem').filter({ hasText: heading });
	await card.getByRole('button', { name: 'Switch off' }).click();
	await expect(card.getByRole('button', { name: 'Switch on' })).toBeVisible();
	expect((await rowByTitle(heading)).is_active).toBe(false);
	await guest.goto('/');
	await expect(guest.getByRole('heading', { name: heading })).toHaveCount(0);

	await page.goto(`/admin/hero/${row.id}`);
	await page.getByRole('button', { name: 'Duplicate' }).click();
	await expect(page).toHaveURL(/\/admin\/hero\/[0-9a-f-]{36}$/);
	expect(page.url()).not.toContain(row.id);
	await expect(page.getByLabel('Title (English)', { exact: true })).toHaveValue(heading);

	await page.goto(`/admin/hero/${row.id}`);
	await page.getByRole('button', { name: 'Archive' }).click();
	await expect(page.getByRole('button', { name: 'Restore' })).toBeVisible();
	expect((await rowByTitle(heading)).archived_at).not.toBeNull();
	/* The current list keeps only the copy (same title), the archive вЂ” the original. */
	await page.goto('/admin/hero');
	await expect(page.getByRole('listitem').filter({ hasText: heading })).toHaveCount(1);
	await expect(
		page
			.getByRole('listitem')
			.filter({ hasText: heading })
			.getByRole('button', { name: 'Switch on' })
	).toBeVisible();
	await page.goto('/admin/hero?archived=1');
	await expect(page.getByRole('listitem').filter({ hasText: heading })).toHaveCount(1);

	const actions =
		await sql`select action from audit_log where entity_id = ${row.id} order by created_at`;
	expect(actions.map((a) => a.action)).toEqual(['hero.create', 'hero.deactivate', 'hero.archive']);
});

test('order: "Move up" puts the block before the previous one', async ({ page }) => {
	await registerAs(page, 'editor');
	const [a, b] = [title('order-a'), title('order-b')];
	await sql`insert into hero_blocks (type, title, sort_order)
		values ('custom', ${sql.json({ en: a })}, 100000), ('custom', ${sql.json({ en: b })}, 100001)`;
	/* Other files add and archive blocks meanwhile: a stale list is refused, so reload and retry. */
	await expect(async () => {
		await page.goto('/admin/hero');
		await page
			.getByRole('listitem')
			.filter({ hasText: b })
			.getByRole('button', { name: 'Move up' })
			.click();
		await page.waitForLoadState();
		const [rowA, rowB] = [await rowByTitle(a), await rowByTitle(b)];
		expect(rowB.sort_order).toBeLessThan(rowA.sort_order);
	}).toPass({ timeout: 30_000 });
	const items = page.getByRole('listitem').filter({ hasText: /E2e hero order-/ });
	await expect(items.first()).toContainText(b);
});

test('event block shows the event and links to it; video block plays only on click', async ({
	page,
	browser
}) => {
	test.setTimeout(90_000);
	await registerAs(page, 'editor');
	const guest = await (await browser.newContext()).newPage();
	const slug = `e2e-hero-${crypto.randomUUID().slice(0, 8)}`;
	const [event] = await sql`
		insert into events (slug, title, status, published_at, starts_at, ends_at, city)
		values (${slug}, ${sql.json({ en: 'E2e hero fest' })}, 'published', now() - interval '1 day',
			now() + interval '20 days', now() + interval '21 days', 'Yerevan')
		returning id`;

	const eventHeading = title('event');
	await page.goto('/admin/hero/new');
	await page.getByLabel('Type').selectOption('event');
	await page.getByLabel('Title (English)', { exact: true }).fill(eventHeading);
	await page.getByLabel('Event', { exact: true }).selectOption(event.id);
	await page.getByLabel('Active').check();
	await page.getByRole('button', { name: 'Save' }).click();
	await expect(page).toHaveURL(/\/admin\/hero\/[0-9a-f-]{36}$/);
	const eventRow = await rowByTitle(eventHeading);
	expect(eventRow).toMatchObject({ type: 'event', event_id: event.id });
	await putFirst(eventRow.id);
	await guest.goto('/');
	await expect(guest.getByRole('heading', { level: 1, name: eventHeading })).toBeVisible();
	await expect(guest.getByRole('link', { name: 'Event details' })).toHaveAttribute(
		'href',
		`/events/${slug}`
	);
	await sql`update hero_blocks set is_active = false where id = ${eventRow.id}`;

	const videoHeading = title('video');
	await page.goto('/admin/hero/new');
	await page.getByLabel('Type').selectOption('video');
	await page.getByLabel('Title (English)', { exact: true }).fill(videoHeading);
	await page.getByLabel('Video link').fill('https://www.youtube.com/watch?v=kMpYHcuipuY');
	await page.getByLabel('Active').check();
	await page.getByRole('button', { name: 'Save' }).click();
	await expect(page).toHaveURL(/\/admin\/hero\/[0-9a-f-]{36}$/);
	await putFirst((await rowByTitle(videoHeading)).id);
	await guest.goto('/');
	const hero = guest.getByRole('region', { name: 'Featured' });
	await expect(hero.getByRole('heading', { level: 1, name: videoHeading })).toBeVisible();
	await expect(hero.locator('iframe')).toHaveCount(0);
	await hero.getByRole('button', { name: 'Play video' }).click();
	await expect(hero.locator('iframe')).toHaveAttribute(
		'src',
		/^https:\/\/www\.youtube-nocookie\.com\/embed\/kMpYHcuipuY/
	);
});

test('a video link of another site is refused at the field', async ({ page }) => {
	await registerAs(page, 'editor');
	await page.goto('/admin/hero/new');
	await page.getByLabel('Type').selectOption('video');
	await page.getByLabel('Title (English)', { exact: true }).fill(title('bad-video'));
	await page.getByLabel('Video link').fill('https://vimeo.com/123');
	await page.getByRole('button', { name: 'Save' }).click();
	await expect(page).toHaveURL('/admin/hero/new');
	await expect(page.getByText('YouTube or Instagram link')).toBeVisible();
});

test('person search: only adults, only name and avatar; members get 404', async ({
	page,
	browser
}) => {
	await registerAs(page, 'editor');
	const tag = `Herop${crypto.randomUUID().slice(0, 8)}`;
	const adult = `e2e-hero-adult-${crypto.randomUUID()}@example.com`;
	const minor = `e2e-hero-minor-${crypto.randomUUID()}@example.com`;
	await sql`insert into users (email, name, first_name, last_name, birth_date) values
		(${adult}, ${`Adult ${tag}`}, 'Adult', ${tag}, '1990-01-01'),
		(${minor}, ${`Minor ${tag}`}, 'Minor', ${tag}, (current_date - interval '15 years')::date)`;
	const res = await page.request.get(`/admin/hero/persons?q=${tag}`);
	expect(res.status()).toBe(200);
	const found = await res.json();
	expect(found).toEqual([{ id: expect.any(String), name: `Adult ${tag}`, avatarKey: null }]);

	const member = await (await browser.newContext()).newPage();
	await registerAs(member, 'member');
	expect((await member.request.get(`/admin/hero/persons?q=${tag}`)).status()).toBe(404);
});
