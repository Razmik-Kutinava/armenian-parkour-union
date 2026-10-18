import { expect, type Page } from '@playwright/test';
import type postgres from 'postgres';
import { roleCan } from '../../src/lib/server/auth/permissions';
import type { Access } from './admin-access-map';

export type Role = 'member' | 'editor' | 'moderator' | 'admin';
export const ORIGIN = { origin: 'http://localhost:4173' };

/* Every field any admin form reads: if a guard were missing, the action would really run. */
export const HOSTILE_FORM = (userId: string, heroId: string) => ({
	userId,
	id: heroId,
	order: heroId,
	type: 'custom',
	isActive: 'on',
	active: 'true',
	role: 'admin',
	comment: 'hostile',
	email: `e2e-hostile-${crypto.randomUUID()}@example.com`,
	firstName: 'Hacked',
	lastName: 'Hacked',
	birthDate: '1990-01-01',
	locale: 'hy',
	'alt.en': 'Hacked',
	key: `media/2026/10/${crypto.randomUUID()}.png`,
	name: 'hacked.png',
	mime: 'image/png',
	size: '10',
	slug: `e2e-hostile-${crypto.randomUUID().slice(0, 8)}`,
	'title.en': 'Hacked',
	'body.en': '<p>Hacked</p>',
	status: 'published',
	action: 'publish',
	startsAt: '2099-01-01T10:00',
	endsAt: '2099-01-01T12:00',
	price: '0',
	priceCurrency: 'AMD',
	'name.en': 'Hacked',
	discipline: 'speed'
});

/* docs/04 section 5.4: member → 404 for all of /admin, staff without the permission → 403. */
export const expectedStatus = (role: Role, access: Access) =>
	role === 'member' ? 404 : access === 'staff' || roleCan(role, access) ? 200 : 403;

export type Ids = {
	userId: string;
	auditId: string;
	mediaId: string;
	pageId: string;
	postId: string;
	eventId: string;
	heroId: string;
};
export const toPath = (key: string, ids: Ids) =>
	key
		.replace(/^(GET|POST) /, '')
		.replace('/users/[id]', `/users/${ids.userId}`)
		.replace('/audit/[id]', `/audit/${ids.auditId}`)
		.replace('/media/[id]', `/media/${ids.mediaId}`)
		.replace('/pages/[id]', `/pages/${ids.pageId}`)
		.replace('/news/[id]', `/news/${ids.postId}`)
		.replace('/events/[id]', `/events/${ids.eventId}`)
		.replace('/hero/[id]', `/hero/${ids.heroId}`)
		.replace('?/default', '');

/* Takes the spec's connection: a worker may run several specs, each ends its own. */
export function permissionFixtures(sql: postgres.Sql) {
	async function registerAs(page: Page, role: Role) {
		const email = `e2e-perm-${role}-${crypto.randomUUID()}@example.com`;
		await page.goto('/register');
		await page.getByLabel('Email').fill(email);
		await page.getByLabel('Password').fill('parkour-pass-1');
		await page.getByLabel('First name').fill('Perm');
		await page.getByLabel('Last name').fill(role);
		await page.getByLabel('Date of birth').fill('1990-01-01');
		await page.getByLabel(/privacy policy/).check();
		await page.getByRole('button', { name: 'Create account' }).click();
		await expect(page).toHaveURL('/');
		await sql`update users set role = ${role} where email = ${email}`;
	}

	const slug = () => `e2e-perm-${crypto.randomUUID().slice(0, 8)}`;
	const idOf = (rows: readonly postgres.Row[]) => rows[0].id as string;

	return {
		registerAs,
		insertMember: async () =>
			idOf(
				await sql`
				insert into users (email, name, first_name, last_name, birth_date)
				values (${`e2e-perm-target-${crypto.randomUUID()}@example.com`}, 'Perm Target', 'Perm',
					'Target', '1990-01-01') returning id`
			),
		insertMedia: async (uploadedBy: string) =>
			idOf(
				await sql`
				insert into media (key, original_name, mime, size_bytes, uploaded_by)
				values (${`media/2026/10/${crypto.randomUUID()}.png`}, 'perm.png', 'image/png', 10,
					${uploadedBy}) returning id`
			),
		insertPage: async () =>
			idOf(
				await sql`insert into pages (slug, title, status)
				values (${slug()}, ${sql.json({ en: 'Perm' })}, 'draft') returning id`
			),
		insertPost: async () =>
			idOf(
				await sql`insert into posts (slug, title, status)
				values (${slug()}, ${sql.json({ en: 'Perm' })}, 'draft') returning id`
			),
		/* Published and started: every status action (publish aside) could really run on it. */
		insertEvent: async () => {
			const id = idOf(
				await sql`
				insert into events (slug, title, status, published_at, starts_at, ends_at)
				values (${slug()}, ${sql.json({ en: 'Perm' })}, 'published', now() - interval '2 days',
					now() - interval '1 day', now() - interval '20 hours') returning id`
			);
			await sql`insert into event_categories (event_id, name) values (${id}, ${sql.json({ en: 'Perm' })})`;
			return id;
		},
		insertHero: async () =>
			idOf(
				await sql`insert into hero_blocks (type, title)
				values ('custom', ${sql.json({ en: 'E2e perm hero' })}) returning id`
			),
		targetRow: async (id: string) =>
			(await sql`select role, status, email_verified, first_name from users where id = ${id}`)[0],
		mediaRow: async (id: string) =>
			(await sql`select alt, deleted_at from media where id = ${id}`)[0],
		pageRow: async (id: string) =>
			(await sql`select slug, title, body, status, deleted_at from pages where id = ${id}`)[0],
		postRow: async (id: string) => (await sql`select * from posts where id = ${id}`)[0],
		eventRows: async (id: string) => ({
			event: (await sql`select * from events where id = ${id}`)[0],
			categories: await sql`select * from event_categories where event_id = ${id} order by id`
		}),
		/* Without the order: admin-audit.spec.ts reorders every current block in parallel. */
		heroRow: async (id: string) =>
			(
				await sql`select type, title, subtitle, media_key, video_url, cta_label, cta_url, event_id,
					person_user_id, is_active, starts_at, ends_at, archived_at, created_by
					from hero_blocks where id = ${id}`
			)[0]
	};
}
