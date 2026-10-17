import { existsSync } from 'node:fs';
import { expect, test } from '@playwright/test';
import postgres from 'postgres';

if (!process.env.DATABASE_URL && existsSync('.env')) process.loadEnvFile('.env');
const sql = postgres(process.env.DATABASE_URL ?? '', { max: 1, onnotice: () => {} });
test.afterAll(() => sql.end());

test('home page announces the festival as planned', async ({ page }) => {
	await page.goto('/');
	await expect(page.getByRole('heading', { level: 1 })).toHaveText('Yerevan Parkour Fest 2027');
	await expect(page.getByText('Yerevan · 14–17 June 2027')).toBeVisible();
	await expect(page.getByText('Planned dates')).toBeVisible();
	await expect(page.getByAltText('Yerevan Parkour Fest 2027 poster')).toHaveAttribute(
		'src',
		/poster-en\.png$/
	);
	await expect(page.getByRole('link', { name: 'info@parkour.am' })).toBeVisible();
});

test('parkour video loads the player only on click', async ({ page }) => {
	await page.goto('/');
	await expect(page.getByRole('heading', { name: 'What is parkour' })).toBeVisible();
	await expect(page.locator('iframe')).toHaveCount(0);
	await page.getByRole('button', { name: 'Play video' }).click();
	await expect(page.locator('iframe')).toHaveAttribute(
		'src',
		/^https:\/\/www\.youtube-nocookie\.com\/embed\/kMpYHcuipuY/
	);
	await page.goto('/ru');
	await expect(page.getByRole('heading', { name: 'Что такое паркур' })).toBeVisible();
});

test('festival announcement is translated', async ({ page }) => {
	await page.goto('/hy');
	await expect(page.getByText('Երևան · 2027 թ. հունիսի 14–17')).toBeVisible();
	await expect(page.locator('img[src$="poster-hy.png"]')).toBeVisible();
	await page.goto('/ru');
	await expect(page.getByText('Ереван · 14–17 июня 2027')).toBeVisible();
	await expect(page.locator('img[src$="poster.png"]')).toBeVisible();
});

test('home page sections in the order of docs/06 section 4.1', async ({ page }) => {
	const tag = crypto.randomUUID().slice(0, 8);
	const eventSlug = `e2e-home-${tag}`;
	const postSlug = `e2e-home-${tag}`;
	await sql`insert into events (slug, title, status, published_at, starts_at, ends_at)
		values (${eventSlug}, ${sql.json({ en: `E2e home event ${tag}` })}, 'published',
			now() - interval '1 day', now() + interval '2 hours', now() + interval '5 hours')`;
	await sql`insert into posts (slug, title, status, published_at)
		values (${postSlug}, ${sql.json({ en: `E2e home news ${tag}` })}, 'published', now())`;
	const [about] = await sql`select status from pages where slug = 'about' and deleted_at is null`;

	await page.goto('/');
	const main = page.getByRole('main');
	await expect(main.getByRole('region', { name: 'Featured' })).toBeVisible();
	await expect(main.getByRole('link', { name: `E2e home event ${tag}` })).toHaveAttribute(
		'href',
		`/events/${eventSlug}`
	);
	await expect(main.getByRole('link', { name: 'All events' })).toHaveAttribute('href', '/events');
	await expect(main.getByRole('link', { name: `E2e home news ${tag}` })).toHaveAttribute(
		'href',
		`/news/${postSlug}`
	);
	await expect(main.getByRole('link', { name: 'All news' })).toHaveAttribute('href', '/news');
	await expect(main.getByRole('link', { name: 'Join the federation' }).last()).toHaveAttribute(
		'href',
		'/register'
	);
	await expect(main.getByRole('link', { name: 'Sign in' })).toHaveAttribute('href', '/login');

	const order = ['Upcoming events', 'About the federation', 'News', 'How it works', 'Join us'];
	const expected =
		about?.status === 'published' ? order : order.filter((h) => !h.startsWith('About'));
	const headings = await main.getByRole('heading', { level: 2 }).allTextContents();
	expect(headings.map((h) => h.trim()).filter((h) => order.includes(h))).toEqual(expected);
	await expect(main.getByRole('heading', { name: 'Shop' })).toHaveCount(0);
	await expect(main.getByRole('heading', { name: 'Support' })).toHaveCount(0);

	await page.goto('/ru');
	await expect(
		page.getByRole('main').getByRole('heading', { level: 2, name: 'Ближайшие события' })
	).toBeVisible();
});
