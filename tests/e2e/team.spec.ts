import { existsSync } from 'node:fs';
import { expect, test } from '@playwright/test';
import postgres from 'postgres';

/* docs/06 section 4.6: coaches and judges, public and active, with a live certificate. Card —
 * photo, name, category, description; no contacts. Rows are written here directly. */

if (!process.env.DATABASE_URL && existsSync('.env')) process.loadEnvFile('.env');
const sql = postgres(process.env.DATABASE_URL ?? '', { max: 1, onnotice: () => {} });

const TAG = `e2e-team-${crypto.randomUUID().slice(0, 8)}`;
const PHONE = '+37499000888';
const ids: string[] = [];

async function staff(last: string, kind: 'trainer' | 'judge', isPublic: boolean) {
	const email = `${TAG}-${last.toLowerCase()}@example.com`;
	const [user] = await sql`insert into users (email, name, first_name, last_name, birth_date,
		phone, locale) values (${email}, ${TAG}, 'Tigran', ${`${last}-${TAG}`}, '1990-02-03',
		${PHONE}, 'en') returning id`;
	const id = user.id as string;
	ids.push(id);
	const token = crypto.randomUUID().replaceAll('-', '');
	await sql`insert into certificates (user_id, kind, number, public_token, status, issued_at,
		expires_at, issued_by) values (${id}, ${kind}, ${`E2E-${token.slice(0, 12)}`}, ${token},
		'active', now() - interval '30 days', now() + interval '300 days', ${id})`;
	await sql`insert into staff_profiles (user_id, kind, category, bio, is_public)
		values (${id}, ${kind}, ${`Category ${last}`}, ${sql.json({ en: `About ${last}`, ru: `О ${last}` })},
		${isPublic})`;
	return { email, name: `Tigran ${last}-${TAG}` };
}

let coach = { email: '', name: '' };
let judge = { email: '', name: '' };
let hidden = { email: '', name: '' };

test.beforeAll(async () => {
	coach = await staff('Coach', 'trainer', true);
	judge = await staff('Judge', 'judge', true);
	hidden = await staff('Hidden', 'trainer', false);
});

test.afterAll(async () => {
	await sql`delete from staff_profiles where user_id = any(${ids})`;
	await sql`delete from certificates where user_id = any(${ids})`;
	await sql`update users set deleted_at = now() where id = any(${ids})`;
	await sql.end();
});

test('coaches and judges in two sections; hidden profile and contacts are not shown', async ({
	page
}) => {
	await page.goto('/federation/team');
	const main = page.locator('main');
	await expect(main.getByRole('heading', { level: 1 })).toHaveText('Coaches and judges');

	const coaches = main.getByRole('region', { name: 'Coaches' });
	const judges = main.getByRole('region', { name: 'Judges' });
	await expect(coaches.getByText(coach.name)).toBeVisible();
	await expect(coaches.getByText('Category Coach')).toBeVisible();
	await expect(coaches.getByText('About Coach')).toBeVisible();
	await expect(judges.getByText(judge.name)).toBeVisible();
	await expect(coaches.getByText(judge.name)).toHaveCount(0);

	const html = await page.content();
	for (const secret of [hidden.name, coach.email, PHONE, '1990-02-03', ...ids])
		expect(html).not.toContain(secret);
});

test('in Russian; reachable from "About the federation"', async ({ page }) => {
	await page.goto('/ru/federation/team');
	const main = page.locator('main');
	await expect(main.getByRole('heading', { level: 1 })).toHaveText('Тренеры и судьи');
	await expect(main.getByText('О Coach')).toBeVisible();

	await page.goto('/federation');
	await page.locator('main').getByRole('link', { name: 'Coaches and judges' }).click();
	await expect(page).toHaveURL(/\/federation\/team$/);
});
