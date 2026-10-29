import { existsSync } from 'node:fs';
import { expect, test } from '@playwright/test';
import postgres from 'postgres';

/* docs/06 section 4.12: the QR of the card leads here. Valid — name, number, "valid until", partner
 * perks; not valid — the number only; no contacts or birth date; not indexed, not cached. */

if (!process.env.DATABASE_URL && existsSync('.env')) process.loadEnvFile('.env');
const sql = postgres(process.env.DATABASE_URL ?? '', { max: 1, onnotice: () => {} });

const TAG = `e2e-vcheck-${crypto.randomUUID().slice(0, 8)}`;
const EMAIL = `${TAG}@example.com`;
const PHONE = '+37499000778';
const TOKEN = crypto.randomUUID().replaceAll('-', '');
const NUMBER = `E2E-V-${TOKEN.slice(0, 10)}`;
let ownerId = '';
let partnerId = '';

test.beforeAll(async () => {
	const [user] = await sql`insert into users (email, name, first_name, last_name, birth_date,
		phone, email_verified, avatar_key, locale) values (${EMAIL}, ${TAG}, 'Lilit', 'Sargsyan',
		'1994-06-23', ${PHONE}, true, ${`avatars/${TAG}.jpg`}, 'en') returning id`;
	ownerId = user.id as string;
	await sql`insert into memberships (user_id, status, starts_at, ends_at)
		values (${ownerId}, 'active', now() - interval '1 day', now() + interval '300 days')`;
	await sql`insert into volunteer_cards (user_id, applied_at, status, number, public_token, issued_at)
		values (${ownerId}, now(), 'active', ${NUMBER}, ${TOKEN}, now())`;
	const [partner] = await sql`insert into volunteer_partners (name, status)
		values (${`E2e check partner ${TAG}`}, 'published') returning id`;
	partnerId = partner.id as string;
	await sql`insert into volunteer_perks (partner_id, title, terms, kind, status) values
		(${partnerId}, ${sql.json({ en: `Free tea ${TAG}`, hy: `Անվճար թեյ ${TAG}` })},
		${sql.json({ en: 'Show the card' })}, 'reusable', 'published')`;
});

test.afterAll(async () => {
	await sql`update volunteer_partners set status = 'archived' where id = ${partnerId}`;
	await sql`update users set deleted_at = now() where id = ${ownerId}`;
	await sql.end();
});

test('unknown or broken token: 404', async ({ request }) => {
	for (const path of ['/volunteer/nope', `/hy/volunteer/${'a'.repeat(80)}`, '/ru/volunteer/x']) {
		const res = await request.get(path, { maxRedirects: 0 });
		expect(res.status(), path).toBe(404);
	}
});

test('valid card from the QR (Armenian): name, number, perks; no personal data; noindex', async ({
	page
}) => {
	const res = await page.goto(`/hy/volunteer/${TOKEN}`);
	expect(res?.status()).toBe(200);
	expect(res?.headers()['x-robots-tag']).toBe('noindex');
	expect(res?.headers()['cache-control']).toBe('no-store');
	await expect(page.locator('meta[name="robots"]')).toHaveAttribute('content', 'noindex');

	const main = page.locator('main');
	await expect(main.getByRole('heading', { level: 1 })).toHaveText('Կամավորի գրքույկի ստուգում');
	await expect(main.getByRole('status')).toContainText('Գործում է');
	await expect(main.getByText('Lilit Sargsyan')).toBeVisible();
	await expect(main.getByText(NUMBER)).toBeVisible();
	await expect(main.getByText('Գործում է մինչև')).toBeVisible();
	await expect(main.getByText(`E2e check partner ${TAG}`)).toBeVisible();
	await expect(main.getByText(`Անվճար թեյ ${TAG}`)).toBeVisible();
	await expect(main.getByText('Show the card')).toBeVisible();

	const html = await page.content();
	for (const secret of [EMAIL, PHONE, '1994-06-23', ownerId]) expect(html).not.toContain(secret);
});

test('not valid (revoked), in English: the number only — no name, photo or partners', async ({
	page
}) => {
	await sql`update volunteer_cards set status = 'revoked', review_note = ${`Hidden ${TAG}`},
		reviewed_at = now() where user_id = ${ownerId}`;
	try {
		await page.goto(`/volunteer/${TOKEN}`);
		const main = page.locator('main');
		await expect(main.getByRole('heading', { level: 1 })).toHaveText('Volunteer card check');
		await expect(main.getByRole('status')).toContainText('The card is not valid');
		await expect(main.getByText(NUMBER)).toBeVisible();
		await expect(main.getByRole('img')).toHaveCount(0);
		const html = await page.content();
		for (const hidden of ['Lilit', 'Sargsyan', `Hidden ${TAG}`, `E2e check partner ${TAG}`]) {
			expect(html).not.toContain(hidden);
		}
	} finally {
		await sql`update volunteer_cards set status = 'active', review_note = null
			where user_id = ${ownerId}`;
	}
});
