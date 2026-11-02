import { existsSync } from 'node:fs';
import { expect, test, type Page } from '@playwright/test';
import postgres from 'postgres';
import { hydrated } from './hydrated';

/* docs/05 section 28 "Cashiers", docs/06 section 4.13, docs/03 section 19.4: the admin creates an
 * access, the link is shown once; the cashier's phone binds by it once (a long httpOnly cookie);
 * another phone gets "link not valid"; disable unbinds at once. Not indexed, not cached. */

if (!process.env.DATABASE_URL && existsSync('.env')) process.loadEnvFile('.env');
const sql = postgres(process.env.DATABASE_URL ?? '', { max: 1, onnotice: () => {} });
const TAG = crypto.randomUUID().slice(0, 8);
const PARTNER = `E2e cashier partner ${TAG}`;
let partnerId = '';

test.beforeAll(async () => {
	const [partner] = await sql`insert into volunteer_partners (name, status)
		values (${PARTNER}, 'published') returning id`;
	partnerId = partner.id as string;
});
test.afterAll(async () => {
	await sql`update partner_cashiers set disabled_at = now() where partner_id = ${partnerId}`;
	await sql`update volunteer_partners set status = 'archived' where id = ${partnerId}`;
	await sql.end();
});
test.beforeEach(async () => {
	await sql`delete from rate_limit where key ~ '^sign-up:ip:(127\.0\.0\.1|::1|::ffff:127\.0\.0\.1)$'`;
});

async function registerAdmin(page: Page) {
	const email = `e2e-cashier-admin-${crypto.randomUUID()}@example.com`;
	await page.goto('/register');
	await page.getByLabel('Email').fill(email);
	await page.getByLabel('Password').fill('parkour-pass-1');
	await page.getByLabel('First name').fill('Cashier');
	await page.getByLabel('Last name').fill('Admin');
	await page.getByLabel('Date of birth').fill('1990-01-01');
	await page.getByLabel(/privacy policy/).check();
	await page.getByRole('button', { name: 'Create account' }).click();
	await expect(page).toHaveURL('/cabinet');
	await sql`update users set role = 'admin' where email = ${email}`;
}

test('cashier access: created by the admin, binds one phone once, disabled at once', async ({
	page,
	browser
}) => {
	test.setTimeout(90_000);
	await registerAdmin(page);
	await page.goto(`/admin/volunteer/partners/${partnerId}`);
	await page.getByRole('link', { name: 'Cashiers' }).click();
	await expect(page).toHaveURL(`/admin/volunteer/partners/${partnerId}/cashiers`);
	await hydrated(page);
	await page.getByLabel('Who or where').fill('Till 1');
	await page.getByRole('button', { name: 'Create access' }).click();
	const link = await page.getByRole('textbox', { name: 'Invite link' }).inputValue();
	expect(link).toMatch(/\/hy\/partner\/join\/[A-Za-z0-9_-]{43}$/);
	const row = page.getByRole('row', { name: /Till 1/ });
	await expect(row).toContainText('Waiting for the phone');
	const token = link.split('/').pop()!;
	expect(await sql`select 1 from partner_cashiers where invite_token_hash = ${token}`).toHaveLength(
		0
	);
	await page.reload();
	await expect(page.getByRole('textbox', { name: 'Invite link' })).toHaveCount(0);

	const phone = await browser.newContext();
	const cashier = await phone.newPage();
	const path = new URL(link).pathname;
	const res = await cashier.goto(path);
	expect(res?.headers()['x-robots-tag']).toBe('noindex');
	expect(res?.headers()['cache-control']).toBe('no-store');
	await expect(cashier.locator('meta[name="robots"]')).toHaveAttribute('content', 'noindex');
	await expect(cashier.locator('main')).toContainText(PARTNER);
	await cashier.getByRole('button', { name: 'Կապել այս հեռախոսը' }).click();
	await expect(cashier).toHaveURL('/hy/partner');
	await expect(cashier.locator('main')).toContainText(`${PARTNER}, Till 1`);
	const cookie = (await phone.cookies()).find((c) => c.name === 'apu_cashier');
	expect(cookie?.httpOnly).toBe(true);
	expect(cookie!.expires * 1000).toBeGreaterThan(Date.now() + 365 * 86_400_000);

	const other = await browser.newContext();
	const second = await other.newPage();
	await second.goto(path);
	await expect(second.locator('main')).toContainText('Հղումն անվավեր է');
	await expect(second.locator('main').getByRole('button')).toHaveCount(0);
	await second.goto('/hy/partner');
	await expect(second.locator('main')).toContainText('Հեռախոսը կապված չէ');
	await other.close();

	await page.reload();
	await expect(row).toContainText('Bound');
	await row.getByRole('button', { name: 'Disable' }).click();
	await page.getByRole('dialog').getByRole('button', { name: 'Disable' }).click();
	await expect(row).toContainText('Disabled');
	await expect(row.getByRole('button')).toHaveCount(0);
	await cashier.goto('/hy/partner');
	await expect(cashier.locator('main')).toContainText('Հեռախոսը կապված չէ');
	await phone.close();
});

test('bound cashier marks a perk on the volunteer check page', async ({ page, browser }) => {
	test.setTimeout(120_000);
	const cardToken = crypto.randomUUID().replaceAll('-', '');
	const perkTitle = `E2e mark perk ${TAG}`;
	const [holder] = await sql`insert into users (email, name, first_name, last_name, birth_date,
		email_verified, avatar_key) values (${`e2e-mark-${TAG}@example.com`}, 'Mark', 'Mark', 'Holder',
		'1991-03-03', true, ${`avatars/mark-${TAG}.jpg`}) returning id`;
	await sql`insert into memberships (user_id, status, starts_at, ends_at)
		values (${holder.id}, 'active', now() - interval '1 day', now() + interval '300 days')`;
	const [card] = await sql`insert into volunteer_cards (user_id, applied_at, status, number,
		public_token, issued_at) values (${holder.id}, now(), 'active', ${`E2E-M-${TAG}`},
		${cardToken}, now()) returning id`;
	await sql`insert into volunteer_perks (partner_id, title, kind, status) values (${partnerId},
		${sql.json({ en: perkTitle, hy: perkTitle })}, 'reusable', 'published')`;

	await registerAdmin(page);
	await page.goto(`/admin/volunteer/partners/${partnerId}/cashiers`);
	await hydrated(page);
	await page.getByLabel('Who or where').fill('Mark till');
	await page.getByRole('button', { name: 'Create access' }).click();
	const link = await page.getByRole('textbox', { name: 'Invite link' }).inputValue();

	const phone = await browser.newContext();
	const cashier = await phone.newPage();
	await cashier.goto(new URL(link).pathname);
	await cashier.getByRole('button', { name: 'Կապել այս հեռախոսը' }).click();
	await expect(cashier).toHaveURL('/hy/partner');

	await cashier.goto(`/hy/volunteer/${cardToken}`);
	await expect(cashier.locator('main')).toContainText(PARTNER);
	await expect(cashier.locator('main')).toContainText('Mark till');
	await expect(cashier.locator('main')).toContainText(perkTitle);
	await cashier.getByRole('button', { name: 'Նշել' }).click();
	await hydrated(cashier);
	await cashier.getByRole('button', { name: 'Հաստատել նշումը' }).click();
	await expect(cashier.locator('main')).toContainText('Mark Holder');

	expect(
		await sql`select count(*)::int from perk_redemptions where card_id = ${card.id} and partner_id = ${partnerId}`
	).toEqual([{ count: 1 }]);

	const guest = await browser.newContext();
	const stranger = await guest.newPage();
	await stranger.goto(`/hy/volunteer/${cardToken}`);
	await expect(stranger.getByRole('button', { name: 'Նշել' })).toHaveCount(0);
	await guest.close();
	await phone.close();
});
