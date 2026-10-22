import { expect, type Page } from '@playwright/test';
import type postgres from 'postgres';

/* Takes the spec's connection: a worker may run several specs, each ends its own. */
export function heroFixtures(sql: postgres.Sql) {
	async function registerAs(page: Page, role: 'editor' | 'member') {
		const email = `e2e-hero-${role}-${crypto.randomUUID()}@example.com`;
		await page.goto('/register');
		await page.getByLabel('Email').fill(email);
		await page.getByLabel('Password').fill('parkour-pass-1');
		await page.getByLabel('First name').fill('Hero');
		await page.getByLabel('Last name').fill(role);
		await page.getByLabel('Date of birth').fill('1990-01-01');
		await page.getByLabel(/privacy policy/).check();
		await page.getByRole('button', { name: 'Create account' }).click();
		/* The first sign-up of a run wakes the server and the database. */
		await expect(page).toHaveURL('/cabinet', { timeout: 15_000 });
		await sql`update users set role = ${role} where email = ${email}`;
	}

	return {
		registerAs,
		title: (what: string) => `E2e hero ${what} ${crypto.randomUUID().slice(0, 6)}`,
		/** Other active blocks may exist in the dev database: put this one first on the home page. */
		putFirst: (id: string) => sql`update hero_blocks set sort_order = -1000 where id = ${id}`,
		rowByTitle: async (t: string) =>
			(
				await sql`select * from hero_blocks where title->>'en' = ${t} order by created_at limit 1`
			)[0]
	};
}
