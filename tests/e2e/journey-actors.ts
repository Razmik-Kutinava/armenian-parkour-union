import { createHmac } from 'node:crypto';
import { expect, type Page } from '@playwright/test';
import type postgres from 'postgres';

/* People of the end-to-end journeys (docs/09, 8.11): they sign up through the form and confirm the
 * email by the link; a role and a membership are given by SQL where another journey covers the way. */

export type Person = { id: string; email: string; name: string };

/** The link Better Auth mails after sign-up: `{ email }` signed HS256 with the auth secret. */
function verificationToken(email: string): string {
	const part = (v: object) => Buffer.from(JSON.stringify(v)).toString('base64url');
	const now = Math.floor(Date.now() / 1000);
	const body = `${part({ alg: 'HS256' })}.${part({ email, iat: now, exp: now + 600 })}`;
	const secret = process.env.BETTER_AUTH_SECRET ?? '';
	return `${body}.${createHmac('sha256', secret).update(body).digest('base64url')}`;
}

export function journeyActors(sql: postgres.Sql) {
	async function signUp(page: Page, prefix: string): Promise<Person> {
		const last = `${prefix}${crypto.randomUUID().slice(0, 8)}`;
		const email = `e2e-journey-${last.toLowerCase()}@example.com`;
		await page.goto('/register');
		await page.getByLabel('Email').fill(email);
		await page.getByLabel('Password').fill('parkour-pass-1');
		await page.getByLabel('First name').fill('Ani');
		await page.getByLabel('Last name').fill(last);
		await page.getByLabel('Date of birth').fill('1995-04-20');
		await page.getByLabel(/privacy policy/).check();
		/* 10 sign-ups an hour per address, and every journey signs up two people in parallel. */
		await sql`delete from rate_limit where key ~ '^sign-up:ip:(127\.0\.0\.1|::1|::ffff:127\.0\.0\.1)$'`;
		await page.getByRole('button', { name: 'Create account' }).click();
		await expect(page).toHaveURL('/cabinet');
		const [user] = await sql`select id from users where email = ${email}`;
		return { id: user.id as string, email, name: `Ani ${last}` };
	}

	async function confirmEmail(page: Page, person: Person) {
		const res = await page.goto(`/verify-email?token=${verificationToken(person.email)}`);
		expect(res?.status()).toBe(200);
		await expect(page.getByText('Email confirmed. Thank you!')).toBeVisible();
		await expect(page.getByText('Confirm your email to pay the fee')).toHaveCount(0);
	}

	return {
		signUp,
		confirmEmail,
		/** A confirmed member: the journeys that need one start here. */
		member: async (page: Page, prefix: string) => {
			const person = await signUp(page, prefix);
			await confirmEmail(page, person);
			return person;
		},
		staff: async (page: Page, role: 'moderator' | 'admin') => {
			const person = await signUp(page, role === 'admin' ? 'Admin' : 'Mod');
			await sql`update users set role = ${role} where id = ${person.id}`;
			return person;
		},
		/** What the fee journey ends with: an active membership and the "Novice" level. */
		grantMembership: async (person: Person) => {
			await sql`update users set level = 'novice' where id = ${person.id}`;
			await sql`insert into memberships (user_id, status, starts_at, ends_at)
				values (${person.id}, 'active', now() - interval '1 day', now() + interval '300 days')`;
		},
		/** CI migrates a bare database: the journeys add the rules they award by, never change them. */
		ensureRules: async (codes: Record<string, number>) => {
			for (const [code, points] of Object.entries(codes)) {
				await sql`insert into points_rules (code, title, points, is_active)
					values (${code}, ${sql.json({ en: code })}, ${points}, true)
					on conflict (code) do nothing`;
			}
			const rows = await sql`select points from points_rules
				where code in ${sql(Object.keys(codes))} and is_active and points > 0`;
			return rows.reduce((sum, r) => sum + (r.points as number), 0);
		},
		balanceOf: async (person: Person) =>
			(await sql`select points_balance from users where id = ${person.id}`)[0]
				.points_balance as number
	};
}
