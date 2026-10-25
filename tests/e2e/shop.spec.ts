import { existsSync } from 'node:fs';
import { expect, test, type Page } from '@playwright/test';
import postgres from 'postgres';
import { hydrated } from './hydrated';

/* docs/06 section 4.7: catalog cards, the item page and the order button by user; docs/03
 * section 9 items 1 and 3. Decisions — docs/todo.md 7.5. Items are soft-deleted after the run. */

if (!process.env.DATABASE_URL && existsSync('.env')) process.loadEnvFile('.env');
const sql = postgres(process.env.DATABASE_URL ?? '', { max: 1, onnotice: () => {} });

const TAG = crypto.randomUUID().slice(0, 8);
const slugs = { tee: `e2e-shop-tee-${TAG}`, cap: `e2e-shop-cap-${TAG}`, draft: `e2e-shop-dr-${TAG}` };

test.beforeAll(async () => {
	const item = (slug: string, title: string, stock: number | null, status = 'published') =>
		sql`insert into shop_items (slug, title, description, price_points, stock, options, status,
			sort_order) values (${slug}, ${sql.json({ en: title, ru: `${title} ру` })},
			${sql.json({ en: '<p>Soft cotton</p>' })}, 100, ${stock},
			${sql.json({ Size: ['S', 'M'] })}, ${status}, -100000)`;
	await item(slugs.tee, `E2e tee ${TAG}`, 2);
	await item(slugs.cap, `E2e cap ${TAG}`, 0);
	await item(slugs.draft, `E2e draft ${TAG}`, 5, 'draft');
});

test.afterAll(async () => {
	await sql`update shop_items set deleted_at = now() where slug = any(${Object.values(slugs)})`;
	await sql.end();
});

test.beforeEach(async () => {
	await sql`delete from rate_limit where key ~ '^sign-up:ip:(127\.0\.0\.1|::1|::ffff:127\.0\.0\.1)$'`;
});

async function register(page: Page) {
	const email = `e2e-shop-buyer-${crypto.randomUUID()}@example.com`;
	await page.goto('/register');
	await page.getByLabel('Email').fill(email);
	await page.getByLabel('Password').fill('parkour-pass-1');
	await page.getByLabel('First name').fill('Shop');
	await page.getByLabel('Last name').fill('Buyer');
	await page.getByLabel('Date of birth').fill('1990-01-01');
	await page.getByLabel(/privacy policy/).check();
	await page.getByRole('button', { name: 'Create account' }).click();
	await expect(page).toHaveURL('/cabinet');
	return email;
}

test('a guest sees the catalog and the item; a draft has no page', async ({ page }) => {
	await page.goto('/shop');
	const main = page.locator('main');
	await expect(main.getByRole('heading', { level: 1 })).toHaveText('Shop');
	const tee = main.getByRole('article').filter({ hasText: `E2e tee ${TAG}` });
	await expect(tee).toContainText('100 points');
	await expect(tee).not.toContainText('Out of stock');
	await expect(main.getByRole('article').filter({ hasText: `E2e cap ${TAG}` })).toContainText(
		'Out of stock'
	);
	await expect(main.getByText(`E2e draft ${TAG}`)).toHaveCount(0);

	await tee.getByRole('link', { name: `E2e tee ${TAG}` }).click();
	await expect(page).toHaveURL(`/shop/${slugs.tee}`);
	await expect(main.getByRole('heading', { level: 1 })).toHaveText(`E2e tee ${TAG}`);
	await expect(main.getByText('Soft cotton')).toBeVisible();
	await expect(main.getByLabel('Size')).toBeVisible();
	await expect(main.getByRole('link', { name: 'Log in to order' })).toHaveAttribute(
		'href',
		`/login?returnTo=${encodeURIComponent(`/shop/${slugs.tee}`)}`
	);

	await page.goto(`/shop/${slugs.cap}`);
	await expect(main.getByRole('button', { name: 'Out of stock' })).toBeDisabled();
	await expect(main.getByRole('link', { name: 'Log in to order' })).toHaveCount(0);

	expect((await page.goto(`/shop/${slugs.draft}`))?.status()).toBe(404);
	await page.goto('/ru/shop');
	await expect(main.getByText(`E2e tee ${TAG} ру`)).toBeVisible();
});

test('a member: confirm the email, then too few points, then order for the price', async ({
	page
}) => {
	test.setTimeout(90_000);
	const email = await register(page);
	await page.goto(`/shop/${slugs.tee}`);
	const main = page.locator('main');
	await expect(main.getByText('Confirm your email to order')).toBeVisible();
	await expect(main.getByRole('button', { name: /Order for/ })).toHaveCount(0);

	await sql`update users set email_verified = true, points_balance = 40 where email = ${email}`;
	await page.reload();
	await expect(main.getByRole('button', { name: 'Not enough: 60 points' })).toBeDisabled();

	await sql`update users set points_balance = 100 where email = ${email}`;
	await page.reload();
	await hydrated(page);
	await main.getByLabel('Size').selectOption('M');
	await main.getByRole('button', { name: 'Order for 100 points' }).click();
	await expect(page).toHaveURL(`/shop/${slugs.tee}/order?Size=M`);
});
