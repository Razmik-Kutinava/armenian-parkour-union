import { existsSync } from 'node:fs';
import { expect, test, type Page } from '@playwright/test';
import postgres from 'postgres';
import { hydrated } from './hydrated';

/* docs/03 section 19.1, docs/06 section 5.12 "Card", docs/05 section 28 "Cards": the cabinet shows
 * what is missing, the member applies, an admin issues the card, the member sees the number. */

if (!process.env.DATABASE_URL && existsSync('.env')) process.loadEnvFile('.env');
const sql = postgres(process.env.DATABASE_URL ?? '', { max: 1, onnotice: () => {} });

test.afterAll(() => sql.end());
test.beforeEach(async () => {
	await sql`delete from rate_limit where key ~ '^sign-up:ip:(127\.0\.0\.1|::1|::ffff:127\.0\.0\.1)$'`;
});

async function register(page: Page, lastName: string) {
	const email = `e2e-vcard-${crypto.randomUUID()}@example.com`;
	await page.goto('/register');
	await page.getByLabel('Email').fill(email);
	await page.getByLabel('Password').fill('parkour-pass-1');
	await page.getByLabel('First name').fill('Card');
	await page.getByLabel('Last name').fill(lastName);
	await page.getByLabel('Date of birth').fill('1990-01-01');
	await page.getByLabel(/privacy policy/).check();
	await page.getByRole('button', { name: 'Create account' }).click();
	await expect(page).toHaveURL('/cabinet');
	const [row] = await sql`select id from users where email = ${email}`;
	return row.id as string;
}

test('member applies for a card, an admin issues it, the member sees the number', async ({
	browser
}) => {
	test.setTimeout(90_000);
	const tag = crypto.randomUUID().slice(0, 8);
	const member = await (await browser.newContext()).newPage();
	const memberId = await register(member, `Volunteer ${tag}`);

	await member.goto('/cabinet/volunteer');
	const block = member.getByRole('region', { name: 'Volunteer card' });
	await expect(block.getByText('Confirm your email')).toBeVisible();
	await expect(block.getByText('Active membership')).toBeVisible();
	await expect(block.getByText('Profile photo')).toBeVisible();
	await expect(block.getByRole('button', { name: 'Request a card' })).toHaveCount(0);

	await sql`update users set email_verified = true, avatar_key = ${`avatars/${memberId}.jpg`}
		where id = ${memberId}`;
	await sql`insert into memberships (user_id, status, starts_at, ends_at)
		values (${memberId}, 'active', now() - interval '1 day', now() + interval '300 days')`;
	await member.reload();
	await hydrated(member);
	await block.getByRole('button', { name: 'Request a card' }).click();
	await expect(block.getByText('Your request is under review')).toBeVisible();

	const admin = await (await browser.newContext()).newPage();
	const adminId = await register(admin, `Admin ${tag}`);
	await sql`update users set role = 'admin' where id = ${adminId}`;
	await admin.goto('/admin/volunteer/cards');
	await admin.getByRole('link', { name: `Card Volunteer ${tag}` }).click();
	await expect(admin).toHaveURL(/\/admin\/volunteer\/cards\/[0-9a-f-]{36}$/);
	await hydrated(admin);
	await admin.getByRole('button', { name: 'Issue card' }).click();
	await admin.getByRole('dialog').getByRole('button', { name: 'Issue card' }).click();
	await expect(admin.getByRole('status')).toContainText('Saved');
	const [card] = await sql`select number, status from volunteer_cards where user_id = ${memberId}`;
	expect(card).toMatchObject({ status: 'active', number: expect.stringMatching(/^APU-V-/) });
	const [entry] = await sql`select action from audit_log where actor_id = ${adminId}`;
	expect(entry.action).toBe('volunteer_card.issue');

	const [partner] = await sql`insert into volunteer_partners (name, status)
		values (${`E2e partner ${tag}`}, 'published') returning id`;
	await sql`insert into volunteer_perks (partner_id, title, kind, uses_limit, status)
		values (${partner.id}, ${sql.json({ en: `E2e perk ${tag}` })}, 'single', 2, 'published')`;
	try {
		await member.reload();
		await expect(block.getByText(card.number)).toBeVisible();
		await expect(block.getByText(/Valid until/)).toBeVisible();
		await expect(block.getByRole('img', { name: 'QR code of the card' })).toBeVisible();
		await expect(block.getByRole('link', { name: 'Download PDF' })).toHaveAttribute(
			'href',
			'/cabinet/volunteer/pdf'
		);
		const perks = member.getByRole('region', { name: 'Partner perks' });
		await expect(perks.getByText(`E2e perk ${tag}`)).toBeVisible();
		await expect(perks.getByText('2 of 2 left')).toBeVisible();

		for (const path of ['/cabinet/volunteer/pdf', '/hy/cabinet/volunteer/pdf']) {
			const res = await member.request.get(path);
			expect(res.status(), path).toBe(200);
			expect(res.headers()['content-type']).toBe('application/pdf');
			expect(res.headers()['content-disposition']).toContain(`${card.number}.pdf`);
			expect(res.headers()['cache-control']).toBe('no-store');
			expect((await res.body()).subarray(0, 5).toString()).toBe('%PDF-');
		}
		expect((await admin.request.get('/cabinet/volunteer/pdf')).status()).toBe(404);

		await admin.reload();
		const adminPdf = admin.getByRole('link', { name: 'Download PDF' });
		const href = (await adminPdf.getAttribute('href')) ?? '';
		expect(href).toMatch(/^\/admin\/volunteer\/cards\/[0-9a-f-]{36}\/pdf$/);
		expect((await admin.request.get(href)).status()).toBe(200);
		expect((await member.request.get(href, { maxRedirects: 0 })).status()).not.toBe(200);

		await sql`update memberships set ends_at = now() - interval '1 minute' where user_id = ${memberId}`;
		expect((await member.request.get('/cabinet/volunteer/pdf')).status()).toBe(404);
		expect((await admin.request.get(href)).status()).toBe(404);
		await member.reload();
		await expect(block.getByRole('link', { name: 'Download PDF' })).toHaveCount(0);
		await expect(block.getByRole('img', { name: 'QR code of the card' })).toHaveCount(0);
		await expect(member.getByRole('region', { name: 'Partner perks' })).toHaveCount(0);
	} finally {
		await sql`update volunteer_partners set status = 'archived' where id = ${partner.id}`;
	}
});
