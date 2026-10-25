import { existsSync } from 'node:fs';
import { expect, test, type Page } from '@playwright/test';
import postgres from 'postgres';
import { hydrated } from './hydrated';

/* docs/05 sections 14 and 15, docs/04 section 3.2: products for the editor, orders for the
 * moderator — a status forward with a letter, the shipping note; no cancel (7.6). Decisions —
 * docs/todo.md 7.4. Rows stay in parkour_dev with e2e users. */

if (!process.env.DATABASE_URL && existsSync('.env')) process.loadEnvFile('.env');
const sql = postgres(process.env.DATABASE_URL ?? '', { max: 1, onnotice: () => {} });
test.afterAll(() => sql.end());

test.beforeEach(async () => {
	await sql`delete from rate_limit where key ~ '^sign-up:ip:(127\.0\.0\.1|::1|::ffff:127\.0\.0\.1)$'`;
});

async function registerAs(page: Page, role: 'editor' | 'moderator') {
	const email = `e2e-shop-${role}-${crypto.randomUUID()}@example.com`;
	await page.goto('/register');
	await page.getByLabel('Email').fill(email);
	await page.getByLabel('Password').fill('parkour-pass-1');
	await page.getByLabel('First name').fill('Shop');
	await page.getByLabel('Last name').fill(role);
	await page.getByLabel('Date of birth').fill('1990-01-01');
	await page.getByLabel(/privacy policy/).check();
	await page.getByRole('button', { name: 'Create account' }).click();
	await expect(page).toHaveURL('/cabinet');
	const [user] = await sql`update users set role = ${role} where email = ${email} returning id`;
	return user.id as string;
}

test('an editor creates a product with an option, publishes and duplicates it', async ({
	page
}) => {
	test.setTimeout(90_000);
	const editor = await registerAs(page, 'editor');
	const slug = `e2e-shop-${crypto.randomUUID().slice(0, 8)}`;

	await page.goto('/admin');
	await page
		.getByRole('navigation', { name: 'Admin sections' })
		.getByRole('link', { name: 'Products' })
		.click();
	await expect(page).toHaveURL('/admin/products');
	await page.getByRole('link', { name: 'New product' }).click();
	await expect(page).toHaveURL('/admin/products/new');
	await hydrated(page);
	await page.getByLabel('Page address').fill(slug);
	await page.getByLabel('Title (English)').fill('E2e hoodie');
	await page.getByLabel('Price in points').fill('0');
	await page.getByLabel('Stock').fill('3');
	await page.getByLabel('Option 1', { exact: true }).fill('Size');
	await page.getByLabel('Values of option 1').fill('S, M, L');
	await page.getByRole('button', { name: 'Save' }).click();
	await expect(page.getByText('From 1 to 1 000 000 points.')).toBeVisible();
	expect(await sql`select 1 from shop_items where slug = ${slug}`).toHaveLength(0);

	await page.getByLabel('Price in points').fill('250');
	await page.getByRole('button', { name: 'Save' }).click();
	await expect(page).toHaveURL(/\/admin\/products\/[0-9a-f-]{36}$/);
	const [item] = await sql`select id, status, price_points, stock, options from shop_items
		where slug = ${slug}`;
	expect(item).toMatchObject({
		status: 'draft',
		price_points: 250,
		stock: 3,
		options: { Size: ['S', 'M', 'L'] }
	});

	await page.getByRole('button', { name: 'Publish' }).click();
	await expect(page.getByRole('button', { name: 'Hide' })).toBeVisible();
	expect((await sql`select status from shop_items where id = ${item.id}`)[0].status).toBe(
		'published'
	);

	await page.getByRole('button', { name: 'Duplicate' }).click();
	await expect(page).not.toHaveURL(`/admin/products/${item.id}`);
	const [copy] = await sql`select status from shop_items where slug = ${`${slug}-copy`}`;
	expect(copy.status).toBe('draft');

	await page.goto(`/admin/products?q=${encodeURIComponent('E2e hoodie')}&status=published`);
	await expect(page.getByRole('table').getByRole('link', { name: 'E2e hoodie' })).toHaveCount(1);

	const log = await sql`select action from audit_log where actor_id = ${editor}
		order by created_at, action`;
	expect(log.map((r) => r.action)).toEqual([
		'shop_item.create',
		'shop_item.update',
		'shop_item.create'
	]);
	expect((await page.goto('/admin/orders'))?.status()).toBe(403);
});

test('a moderator moves an order forward with a shipping note; no cancel', async ({ page }) => {
	test.setTimeout(90_000);
	const tag = crypto.randomUUID().slice(0, 8);
	const [member] = await sql`insert into users (email, name, first_name, last_name, birth_date)
		values (${`e2e-shop-member-${tag}@example.com`}, ${`Buyer ${tag}`}, 'Buyer', ${tag},
			'1990-01-01') returning id`;
	const [item] = await sql`insert into shop_items (slug, title, price_points, status)
		values (${`e2e-shop-${tag}`}, ${sql.json({ en: 'E2e cap' })}, 60, 'published') returning id`;
	const number = `ORD-2099-${tag}`;
	const [order] = await sql`insert into shop_orders
		(number, user_id, total_points, recipient_name, phone, city, address, comment)
		values (${number}, ${member.id}, 120, 'Ani Petrosyan', '+37491000000', 'Vanadzor',
			'Tigranyan 7', 'Ring twice') returning id`;
	await sql`insert into shop_order_items (order_id, item_id, quantity, price_points_snapshot,
		selected_options) values (${order.id}, ${item.id}, 2, 60, ${sql.json({ Size: 'M' })})`;
	const moderator = await registerAs(page, 'moderator');

	await page.goto(`/admin/orders?q=${number}`);
	const row = page.getByRole('table').getByRole('row').filter({ hasText: number });
	await expect(row).toContainText(`Buyer ${tag}`);
	await expect(row).toContainText('E2e cap × 2');
	await row.getByRole('link', { name: number }).click();
	await expect(page).toHaveURL(`/admin/orders/${order.id}`);
	for (const text of ['Ani Petrosyan', '+37491000000', 'Vanadzor', 'Tigranyan 7', 'Ring twice']) {
		await expect(page.getByText(text)).toBeVisible();
	}
	await expect(page.getByText('Size: M')).toBeVisible();
	await expect(page.getByRole('button', { name: /cancel/i })).toHaveCount(0);

	await hydrated(page);
	await page.getByLabel('Shipping note').fill('RR123456789AM');
	await page.getByRole('button', { name: 'Save note' }).click();
	await expect(page.getByText('Saved')).toBeVisible();
	await page.getByRole('button', { name: 'Mark as shipped' }).click();
	await expect(page.getByRole('button', { name: 'Mark as delivered' })).toBeVisible();
	await expect(page.getByRole('button', { name: 'Mark as confirmed' })).toHaveCount(0);
	expect((await sql`select status, tracking_note from shop_orders where id = ${order.id}`)[0])
		.toEqual({ status: 'shipped', tracking_note: 'RR123456789AM' });

	const back = await page.request.post(`/admin/orders/${order.id}?/status`, {
		form: { status: 'cancelled' },
		headers: { origin: 'http://localhost:4173' }
	});
	expect(back.status()).toBe(400);
	expect((await sql`select status from shop_orders where id = ${order.id}`)[0].status).toBe(
		'shipped'
	);

	const log = await sql`select action from audit_log where actor_id = ${moderator}
		order by created_at, action`;
	expect(log.map((r) => r.action)).toEqual(['shop_order.tracking', 'shop_order.status']);
	expect((await page.goto('/admin/products'))?.status()).toBe(403);
});
