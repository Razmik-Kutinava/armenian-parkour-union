import { existsSync } from 'node:fs';
import { expect, test, type Page } from '@playwright/test';
import postgres from 'postgres';
import { hydrated } from './hydrated';

/* docs/06 section 4.7 (delivery form, confirmation), docs/03 section 9 items 3 and 5, docs/05
 * section 15: a member orders for points, an admin cancels with a refund. Decisions —
 * docs/todo.md 7.6. The item is soft-deleted after the run; orders stay with e2e users. */

if (!process.env.DATABASE_URL && existsSync('.env')) process.loadEnvFile('.env');
const sql = postgres(process.env.DATABASE_URL ?? '', { max: 1, onnotice: () => {} });

const TAG = crypto.randomUUID().slice(0, 8);
const slug = `e2e-order-tee-${TAG}`;
const title = `E2e order tee ${TAG}`;
let buyerEmail = '';

test.describe.configure({ mode: 'serial' });

test.beforeAll(async () => {
	await sql`insert into shop_items (slug, title, price_points, stock, options, status, sort_order)
		values (${slug}, ${sql.json({ en: title })}, 100, 2, ${sql.json({ Size: ['S', 'M'] })},
			'published', -100000)`;
});

test.afterAll(async () => {
	await sql`update shop_items set deleted_at = now() where slug = ${slug}`;
	await sql.end();
});

test.beforeEach(async () => {
	await sql`delete from rate_limit where key ~ '^sign-up:ip:(127\.0\.0\.1|::1|::ffff:127\.0\.0\.1)$'`;
});

async function register(page: Page, who: string) {
	const email = `e2e-order-${who}-${crypto.randomUUID()}@example.com`;
	await page.goto('/register');
	await page.getByLabel('Email').fill(email);
	await page.getByLabel('Password').fill('parkour-pass-1');
	await page.getByLabel('First name').fill('Order');
	await page.getByLabel('Last name').fill(who);
	await page.getByLabel('Date of birth').fill('1990-01-01');
	await page.getByLabel(/privacy policy/).check();
	await page.getByRole('button', { name: 'Create account' }).click();
	await expect(page).toHaveURL('/cabinet');
	return email;
}

const itemRow = async () =>
	(await sql`select id, stock from shop_items where slug = ${slug}`)[0] as {
		id: string;
		stock: number;
	};

test('a guest is sent to log in; a member fills delivery, confirms and the order is placed', async ({
	page
}) => {
	test.setTimeout(90_000);
	await page.goto(`/shop/${slug}/order?Size=M`);
	await expect(page).toHaveURL(
		`/login?returnTo=${encodeURIComponent(`/shop/${slug}/order?Size=M`)}`
	);

	buyerEmail = await register(page, 'buyer');
	await sql`update users set email_verified = true, points_balance = 150
		where email = ${buyerEmail}`;
	await page.goto(`/shop/${slug}`);
	await hydrated(page);
	const main = page.locator('main');
	await main.getByLabel('Size').selectOption('M');
	await main.getByRole('button', { name: 'Order for 100 points' }).click();
	await expect(page).toHaveURL(`/shop/${slug}/order?Size=M`);

	await hydrated(page);
	await expect(main.getByLabel('Size')).toHaveValue('M');
	await main.getByLabel('Recipient').fill('Ani Petrosyan');
	await main.getByLabel('Phone').fill('+374 91 000000');
	await main.getByLabel('City').fill('Vanadzor');
	await main.getByLabel('Address').fill('Tigranyan 7');
	await main.getByLabel(/Comment/).fill('Ring twice');
	await main.getByRole('button', { name: 'Continue' }).click();
	await expect(main.getByRole('heading', { name: 'Check your order' })).toBeVisible();
	for (const text of [title, 'Size: M', 'Ani Petrosyan', 'Vanadzor', 'Tigranyan 7', 'Ring twice']) {
		await expect(main.getByText(text, { exact: true })).toBeVisible();
	}
	await expect(main.getByText('Balance after the order: 50 points')).toBeVisible();
	expect((await itemRow()).stock).toBe(2);

	await main.getByRole('button', { name: 'Confirm order for 100 points' }).click();
	await expect(
		main.getByRole('heading', { name: /^Order ORD-\d{4}-\d{4,} is placed$/ })
	).toBeVisible();

	const [order] = await sql`select o.status, o.total_points, o.city, o.comment, u.points_balance
		from shop_orders o join users u on u.id = o.user_id where u.email = ${buyerEmail}`;
	expect(order).toEqual({
		status: 'new',
		total_points: 100,
		city: 'Vanadzor',
		comment: 'Ring twice',
		points_balance: 50
	});
	expect((await itemRow()).stock).toBe(1);
});

test('an admin cancels the order: points and stock come back', async ({ page }) => {
	test.setTimeout(90_000);
	const [order] = await sql`select o.id, o.number from shop_orders o
		join users u on u.id = o.user_id where u.email = ${buyerEmail}`;
	const adminEmail = await register(page, 'admin');
	const [admin] = await sql`update users set role = 'admin' where email = ${adminEmail}
		returning id`;

	await page.goto(`/admin/orders/${order.id}`);
	await hydrated(page);
	await page.getByRole('button', { name: 'Cancel order' }).click();
	await page.getByRole('dialog').getByRole('button', { name: 'Cancel and refund' }).click();
	await expect(page.getByText('Cancelled', { exact: true })).toBeVisible();
	await expect(page.getByRole('button', { name: 'Cancel order' })).toHaveCount(0);

	const [after] = await sql`select o.status, u.points_balance from shop_orders o
		join users u on u.id = o.user_id where o.id = ${order.id}`;
	expect(after).toEqual({ status: 'cancelled', points_balance: 150 });
	expect((await itemRow()).stock).toBe(2);
	const refunds = await sql`select delta from points_ledger
		where source_id = ${order.id} and reason = 'shop_refund'`;
	expect(refunds.map((r) => r.delta)).toEqual([100]);
	const log = await sql`select action, after from audit_log where actor_id = ${admin.id}`;
	expect(log).toEqual([
		expect.objectContaining({
			action: 'shop_order.cancel',
			after: expect.objectContaining({ number: order.number, refund: 100 })
		})
	]);
});
