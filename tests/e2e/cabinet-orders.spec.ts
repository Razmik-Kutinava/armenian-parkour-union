import { existsSync } from 'node:fs';
import { expect, test, type Page } from '@playwright/test';
import postgres from 'postgres';
import { hydrated } from './hydrated';

/* docs/06 section 5.8: list, card with delivery and shipping note; the member cancels a `new` order
 * (question 108, decisions.md 2026-10-25) and gets the points and the stock back. The item is
 * soft-deleted after the run; orders stay with the e2e user (global setup soft-deletes it). */

if (!process.env.DATABASE_URL && existsSync('.env')) process.loadEnvFile('.env');
const sql = postgres(process.env.DATABASE_URL ?? '', { max: 1, onnotice: () => {} });

const TAG = crypto.randomUUID().slice(0, 8);
const slug = `e2e-cabinet-tee-${TAG}`;
const title = `E2e cabinet tee ${TAG}`;

test.afterAll(async () => {
	await sql`update shop_items set deleted_at = now() where slug = ${slug}`;
	await sql.end();
});

test.beforeEach(async () => {
	await sql`delete from rate_limit where key ~ '^sign-up:ip:(127\.0\.0\.1|::1|::ffff:127\.0\.0\.1)$'`;
});

async function register(page: Page) {
	const email = `e2e-orders-${crypto.randomUUID()}@example.com`;
	await page.goto('/register');
	await page.getByLabel('Email').fill(email);
	await page.getByLabel('Password').fill('parkour-pass-1');
	await page.getByLabel('First name').fill('Orders');
	await page.getByLabel('Last name').fill('Owner');
	await page.getByLabel('Date of birth').fill('1990-01-01');
	await page.getByLabel(/privacy policy/).check();
	await page.getByRole('button', { name: 'Create account' }).click();
	await expect(page).toHaveURL('/cabinet');
	const [user] = await sql`select id from users where email = ${email}`;
	return user.id as string;
}

/** An order as the 7.6 service leaves it: write-off entry, balance and stock already down. */
async function addOrder(userId: string, itemId: string, status: string, note: string | null) {
	const number = `ORD-2099-E${crypto.randomUUID().slice(0, 8)}`;
	const [order] = await sql`insert into shop_orders
		(number, user_id, status, total_points, recipient_name, phone, city, address, tracking_note)
		values (${number}, ${userId}, ${status}, 100, 'Ani Petrosyan', '+37491000000', 'Vanadzor',
			'Tigranyan 7', ${note})
		returning id, number`;
	await sql`insert into shop_order_items
		(order_id, item_id, selected_options, quantity, price_points_snapshot)
		values (${order.id}, ${itemId}, ${sql.json({ Size: 'M' })}, 1, 100)`;
	const [entry] =
		await sql`insert into points_ledger (user_id, delta, reason, source_type, source_id)
		values (${userId}, -100, 'shop_order', 'shop_order', ${order.id}) returning id`;
	await sql`update shop_orders set ledger_id = ${entry.id} where id = ${order.id}`;
	return order as { id: string; number: string };
}

test('guest: the orders page sends to log in and back', async ({ page }) => {
	await page.goto('/cabinet/orders');
	await expect(page).toHaveURL('/login?returnTo=%2Fcabinet%2Forders');
});

test('member: sees own orders, the card, cancels a new one and gets the points back', async ({
	page
}) => {
	test.setTimeout(90_000);
	const id = await register(page);
	const [item] = await sql`insert into shop_items (slug, title, price_points, stock, status)
		values (${slug}, ${sql.json({ en: title })}, 100, 0, 'published') returning id`;
	const fresh = await addOrder(id, item.id, 'new', null);
	const shipped = await addOrder(id, item.id, 'shipped', 'HayPost RR123');
	await sql`update users set points_balance = 50 where id = ${id}`;

	await page.goto('/cabinet');
	await page
		.getByRole('navigation', { name: 'Cabinet' })
		.getByRole('link', { name: 'Orders' })
		.click();
	await expect(page).toHaveURL('/cabinet/orders');
	const main = page.locator('main');
	for (const [order, status] of [
		[fresh, 'New'],
		[shipped, 'Shipped']
	] as const) {
		const row = main.getByRole('listitem').filter({ hasText: order.number });
		await expect(row).toContainText(title);
		await expect(row).toContainText('Size: M');
		await expect(row).toContainText('100 points');
		await expect(row).toContainText(status);
	}

	await main.getByRole('link', { name: shipped.number }).click();
	await expect(page).toHaveURL(`/cabinet/orders/${shipped.id}`);
	await expect(main.getByText('HayPost RR123')).toBeVisible();
	await expect(main.getByText('Vanadzor')).toBeVisible();
	await expect(main.getByRole('button', { name: 'Cancel order' })).toHaveCount(0);

	await page.goto(`/cabinet/orders/${fresh.id}`);
	await hydrated(page);
	await expect(main.getByRole('heading', { name: `Order ${fresh.number}` })).toBeVisible();
	await expect(main.getByText('Tigranyan 7')).toBeVisible();
	await main.getByRole('button', { name: 'Cancel order' }).click();
	await expect(
		main.getByText('Order cancelled: 100 points are back on your balance.')
	).toBeVisible();
	await expect(main.getByText('Cancelled', { exact: true })).toBeVisible();
	await expect(main.getByRole('button', { name: 'Cancel order' })).toHaveCount(0);

	const [after] = await sql`select o.status, u.points_balance from shop_orders o
		join users u on u.id = o.user_id where o.id = ${fresh.id}`;
	expect(after).toEqual({ status: 'cancelled', points_balance: 150 });
	const [stock] = await sql`select stock from shop_items where id = ${item.id}`;
	expect(stock.stock).toBe(1);
	const refunds = await sql`select delta, created_by from points_ledger
		where source_id = ${fresh.id} and reason = 'shop_refund'`;
	expect(refunds).toEqual([{ delta: 100, created_by: null }]);
	const log = await sql`select actor_id from audit_log
		where action = 'shop_order.cancel' and entity_id = ${fresh.id}`;
	expect(log).toEqual([{ actor_id: id }]);

	const missing = await page.goto(`/cabinet/orders/${crypto.randomUUID()}`);
	expect(missing?.status()).toBe(404);
});
