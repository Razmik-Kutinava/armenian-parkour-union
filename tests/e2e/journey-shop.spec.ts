import { existsSync } from 'node:fs';
import { expect, test } from '@playwright/test';
import postgres from 'postgres';
import { hydrated } from './hydrated';
import { journeyActors } from './journey-actors';

/* Journey (docs/09, 8.11): an order for points from the product to the delivery. The admin creates
 * and publishes a product and adds points to a member by hand; the member orders it with delivery
 * details; the admin takes the order through confirmed and shipped to delivered; the member sees
 * "Delivered" and the balance went down by the price (docs/03 section 9, docs/05 sections 12, 14-15,
 * docs/06 sections 4.7, 5.8). The product is opened by its address: published products of earlier
 * runs stay and may fill the first catalog page. It is soft-deleted after the run. */

if (!process.env.DATABASE_URL && existsSync('.env')) process.loadEnvFile('.env');
const sql = postgres(process.env.DATABASE_URL ?? '', { max: 1, onnotice: () => {} });
const actors = journeyActors(sql);
const tag = crypto.randomUUID().slice(0, 8);
const slug = `e2e-journey-cap-${tag}`;
const title = `E2e journey cap ${tag}`;

test.afterAll(async () => {
	await sql`update shop_items set deleted_at = now() where slug = ${slug}`;
	await sql.end();
});
test('admin lists a product and adds points, a member orders it, the admin delivers it', async ({
	page,
	browser
}) => {
	test.setTimeout(180_000);
	const member = await actors.member(page, 'Shop');

	const admin = await (await browser.newContext()).newPage();
	await actors.staff(admin, 'admin');
	await admin.goto('/admin/products/new');
	await hydrated(admin);
	await admin.getByLabel('Page address').fill(slug);
	await admin.getByLabel('Title (English)').fill(title);
	await admin.getByLabel('Price in points').fill('120');
	await admin.getByLabel('Stock').fill('5');
	await admin.getByRole('button', { name: 'Save' }).click();
	await expect(admin).toHaveURL(/\/admin\/products\/[0-9a-f-]{36}$/);
	await admin.getByRole('button', { name: 'Publish' }).click();
	await expect(admin.getByRole('button', { name: 'Hide' })).toBeVisible();

	await admin.goto(`/admin/points/new?email=${encodeURIComponent(member.email)}`);
	await expect(admin.locator('main')).toContainText('Current balance: 0');
	await admin.getByLabel('Points (+ or −)').fill('200');
	await admin.getByLabel('Comment').fill(`Jam volunteer ${tag}`);
	const dialog = admin.getByRole('dialog');
	await expect(async () => {
		await admin.getByRole('button', { name: 'Continue' }).click();
		await expect(dialog).toBeVisible({ timeout: 1_000 });
	}).toPass({ timeout: 15_000 });
	await dialog.getByRole('button', { name: 'Save' }).click();
	await expect(admin.getByRole('status')).toContainText('0 → 200');

	await page.goto(`/shop/${slug}`);
	await hydrated(page);
	const main = page.locator('main');
	await main.getByRole('button', { name: 'Order for 120 points' }).click();
	await expect(page).toHaveURL(`/shop/${slug}/order`);
	await hydrated(page);
	await main.getByLabel('Recipient').fill(member.name);
	await main.getByLabel('Phone').fill('+374 91 000000');
	await main.getByLabel('City').fill('Gyumri');
	await main.getByLabel('Address').fill('Abovyan 12');
	await main.getByRole('button', { name: 'Continue' }).click();
	await expect(main.getByText('Balance after the order: 80 points')).toBeVisible();
	await main.getByRole('button', { name: 'Confirm order for 120 points' }).click();
	const placed = main.getByRole('heading', { name: /^Order ORD-\d{4}-\d{4,} is placed$/ });
	await expect(placed).toBeVisible();
	const number = (await placed.textContent())!.match(/ORD-\d{4}-\d+/)![0];

	await admin.goto(`/admin/orders?q=${number}`);
	await admin.getByRole('table').getByRole('link', { name: number }).click();
	await hydrated(admin);
	await expect(admin.getByText('Abovyan 12')).toBeVisible();
	await admin.getByRole('button', { name: 'Mark as confirmed' }).click();
	await expect(admin.getByRole('button', { name: 'Mark as confirmed' })).toHaveCount(0);
	await admin.getByLabel('Shipping note').fill(`HayPost ${tag}`);
	await admin.getByRole('button', { name: 'Save note' }).click();
	await expect(admin.getByText('Saved')).toBeVisible();
	await admin.getByRole('button', { name: 'Mark as shipped' }).click();
	await admin.getByRole('button', { name: 'Mark as delivered' }).click();
	await expect(admin.getByRole('button', { name: /^Mark as / })).toHaveCount(0);

	await page.goto('/cabinet/orders');
	const row = main.getByRole('listitem').filter({ hasText: number });
	await expect(row).toContainText(title);
	await expect(row).toContainText('Delivered');
	await main.getByRole('link', { name: number }).click();
	await expect(main.getByText(`HayPost ${tag}`)).toBeVisible();
	await expect(main.getByRole('button', { name: 'Cancel order' })).toHaveCount(0);

	expect(await actors.balanceOf(member)).toBe(80);
	const [order] = await sql`select o.status, o.total_points, i.stock
		from shop_orders o join shop_order_items oi on oi.order_id = o.id
		join shop_items i on i.id = oi.item_id where o.number = ${number}`;
	expect(order).toEqual({ status: 'delivered', total_points: 120, stock: 4 });
	const ledger = await sql`select delta, reason from points_ledger
		where user_id = ${member.id} order by created_at`;
	expect(ledger.map((r) => [r.delta, r.reason])).toEqual([
		[200, 'manual'],
		[-120, 'shop_order']
	]);
});
