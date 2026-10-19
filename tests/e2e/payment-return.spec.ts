import { existsSync } from 'node:fs';
import { expect, test } from '@playwright/test';
import postgres from 'postgres';

/* docs/07 sections 1 p. 3, 3 p. 7, 7 p. 1, 15: the return pages show the status from the database
 * and never confirm or cancel a payment by themselves. The e2e server is a production build: no
 * mock provider, so rows are written here and no provider is asked. */

if (!process.env.DATABASE_URL && existsSync('.env')) process.loadEnvFile('.env');
const sql = postgres(process.env.DATABASE_URL ?? '', { max: 1, onnotice: () => {} });

const TAG = `e2e-return-${crypto.randomUUID().slice(0, 8)}`;
const EMAIL = `${TAG}@example.com`;

type Kind = 'membership' | 'donation';

test.afterAll(async () => {
	await sql`delete from payments where donor_name = ${TAG}`;
	await sql.end();
});

async function payment(kind: Kind, status: string, provider = 'manual'): Promise<string> {
	const paidAt = status === 'paid' ? new Date() : null;
	const [row] = await sql`insert into payments (kind, status, amount_minor, currency, provider,
		provider_payment_id, donor_name, donor_email, is_anonymous, paid_at)
		values (${kind}, ${status}, 15000, 'AMD', ${provider}, ${`${TAG}-${crypto.randomUUID()}`},
		${TAG}, ${EMAIL}, true, ${paidAt}) returning id`;
	return row.id as string;
}

async function statusOf(id: string): Promise<string> {
	const [row] = await sql`select status from payments where id = ${id}`;
	return row.status as string;
}

test('unknown or broken payment id: 404 on both pages', async ({ request }) => {
	for (const path of [
		'/payment/success',
		'/payment/success?pid=nope',
		`/payment/cancel?pid=${crypto.randomUUID()}`
	]) {
		const res = await request.get(path, { maxRedirects: 0 });
		expect(res.status(), path).toBe(404);
	}
});

test('paid donation: thanks and the amount, no personal data, not indexed', async ({ page }) => {
	const id = await payment('donation', 'paid');
	await page.goto(`/payment/success?pid=${id}`);
	const main = page.locator('main');
	await expect(main.getByRole('heading', { level: 1, name: 'Payment received' })).toBeVisible();
	await expect(main.getByText(/supporting the federation/)).toBeVisible();
	await expect(main.getByText(/Donation.*15,000/)).toBeVisible();
	await expect(page.locator('meta[name="robots"]')).toHaveAttribute('content', 'noindex');
	const html = await page.content();
	expect(html).not.toContain(EMAIL);
	expect(html).not.toContain(TAG);
});

test('paid membership in Russian: received, the link leads to the cabinet', async ({ page }) => {
	const id = await payment('membership', 'paid');
	await page.goto(`/ru/payment/success?pid=${id}`);
	const main = page.locator('main');
	await expect(main.getByRole('heading', { level: 1, name: 'Оплата получена' })).toBeVisible();
	await expect(main.locator('a[href="/ru/cabinet/membership"]')).toBeVisible();
});

test('pending: "checking", then the confirmed status shows up without a reload', async ({
	page
}) => {
	const id = await payment('donation', 'pending');
	await page.goto(`/payment/success?pid=${id}`);
	const main = page.locator('main');
	await expect(main.getByRole('heading', { level: 1, name: /Checking the payment/ })).toBeVisible();
	await sql`update payments set status = 'paid', paid_at = now() where id = ${id}`;
	await expect(main.getByRole('heading', { level: 1, name: 'Payment received' })).toBeVisible({
		timeout: 15_000
	});
});

test('pending and not confirmed: after the checks — being processed, we will email', async ({
	page
}) => {
	test.setTimeout(45_000);
	const id = await payment('membership', 'pending');
	await page.goto(`/payment/success?pid=${id}`);
	const main = page.locator('main');
	await expect(main.getByRole('heading', { level: 1, name: /being processed/ })).toBeVisible({
		timeout: 30_000
	});
	await expect(main.getByText(/send you an email/)).toBeVisible();
	await expect(main.locator('a[href="/cabinet/membership"]')).toBeVisible();
	expect(await statusOf(id)).toBe('pending');
});

test('a forged return does not confirm: the payment of an unavailable provider stays pending', async ({
	page
}) => {
	const id = await payment('donation', 'pending', 'mock');
	await page.goto(`/payment/success?pid=${id}`);
	await expect(page.locator('main').getByRole('heading', { level: 1 })).toBeVisible();
	await page.goto(`/payment/cancel?pid=${id}`);
	await expect(page.locator('main').getByRole('heading', { level: 1 })).toBeVisible();
	expect(await statusOf(id)).toBe('pending');
});

test('cancel page: not completed and try again; the visit does not cancel the payment', async ({
	page
}) => {
	const id = await payment('donation', 'pending');
	await page.goto(`/payment/cancel?pid=${id}`);
	const main = page.locator('main');
	await expect(main.getByRole('heading', { level: 1, name: /not completed/ })).toBeVisible();
	await expect(main.getByRole('link', { name: 'Try again' })).toHaveAttribute('href', '/donate');
	expect(await statusOf(id)).toBe('pending');
});

test('cancelled and failed membership: clear titles, try again in the cabinet', async ({ page }) => {
	const main = page.locator('main');
	await page.goto(`/payment/cancel?pid=${await payment('membership', 'cancelled')}`);
	await expect(main.getByRole('heading', { level: 1, name: /was cancelled/ })).toBeVisible();
	await expect(main.getByRole('link', { name: 'Try again' })).toHaveAttribute(
		'href',
		'/cabinet/membership'
	);
	await page.goto(`/payment/success?pid=${await payment('membership', 'failed')}`);
	await expect(main.getByRole('heading', { level: 1, name: /did not go through/ })).toBeVisible();
	await expect(main.getByRole('link', { name: 'Try again' })).toBeVisible();
});
