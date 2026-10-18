import { existsSync } from 'node:fs';
import { expect, test } from '@playwright/test';
import postgres from 'postgres';
import { ADMIN_READS, ADMIN_WRITES } from './admin-access-map';
import {
	expectedStatus,
	HOSTILE_FORM,
	ORIGIN,
	permissionFixtures,
	toPath
} from './admin-permissions-fixtures';

if (!process.env.DATABASE_URL && existsSync('.env')) process.loadEnvFile('.env');
const sql = postgres(process.env.DATABASE_URL ?? '', { max: 1, onnotice: () => {} });
test.afterAll(() => sql.end());
/* Only sign-up counters: auth.spec.ts runs in parallel and checks the sign-in limit. */
test.beforeEach(async () => {
	await sql`delete from rate_limit where key ~ '^sign-up:ip:(127\.0\.0\.1|::1|::ffff:127\.0\.0\.1)$'`;
});

const {
	registerAs,
	insertMember,
	insertMedia,
	insertPage,
	insertPost,
	insertEvent,
	insertHero,
	targetRow,
	mediaRow,
	pageRow,
	postRow,
	eventRows,
	heroRow
} = permissionFixtures(sql);

for (const role of ['member', 'editor', 'moderator'] as const) {
	test(`${role}: every admin page and action answers by docs/04, data stays`, async ({ page }) => {
		test.setTimeout(90_000);
		const target = await insertMember();
		const before = await targetRow(target);
		const ids = {
			userId: target,
			auditId: crypto.randomUUID(),
			mediaId: await insertMedia(target),
			pageId: await insertPage(),
			postId: await insertPost(),
			eventId: await insertEvent(),
			heroId: await insertHero()
		};
		const mediaBefore = await mediaRow(ids.mediaId);
		const pageBefore = await pageRow(ids.pageId);
		const postBefore = await postRow(ids.postId);
		const eventBefore = await eventRows(ids.eventId);
		const heroBefore = await heroRow(ids.heroId);
		await registerAs(page, role);

		for (const [key, access] of Object.entries(ADMIN_READS)) {
			const res = await page.request.get(toPath(key, ids), { maxRedirects: 0 });
			expect(res.status(), `GET ${key}`).toBe(expectedStatus(role, access));
		}
		for (const [key, access] of Object.entries(ADMIN_WRITES)) {
			const expected = expectedStatus(role, access);
			if (expected === 200) continue;
			const res = await page.request.post(toPath(key, ids), {
				form: HOSTILE_FORM(target, ids.heroId),
				headers: ORIGIN,
				maxRedirects: 0
			});
			expect(res.status(), `POST ${key}`).toBe(expected);
		}

		expect(await targetRow(target)).toEqual(before);
		expect(await mediaRow(ids.mediaId)).toEqual(mediaBefore);
		expect(await pageRow(ids.pageId)).toEqual(pageBefore);
		expect(await postRow(ids.postId)).toEqual(postBefore);
		expect(await eventRows(ids.eventId)).toEqual(eventBefore);
		expect(await heroRow(ids.heroId)).toEqual(heroBefore);
		expect(
			await sql`select 1 from audit_log where entity_id in (${target}, ${ids.mediaId}, ${ids.pageId}, ${ids.postId}, ${ids.eventId}, ${ids.heroId})`
		).toHaveLength(0);
		expect(
			await sql`select 1 from hero_blocks where title->>'en' = 'Hacked' and created_at > now() - interval '10 minutes'`
		).toHaveLength(0);
		expect(await sql`select 1 from pages where slug like 'e2e-hostile-%'`).toHaveLength(0);
		expect(await sql`select 1 from posts where slug like 'e2e-hostile-%'`).toHaveLength(0);
		expect(await sql`select 1 from events where slug like 'e2e-hostile-%'`).toHaveLength(0);
		/* Out of the current list: every block there takes part in the reorder of other runs. */
		await sql`update hero_blocks set archived_at = now() where id = ${ids.heroId}`;
	});
}

test('admin opens every admin page; audit pages take no writes and the entry stays', async ({
	page
}) => {
	test.setTimeout(90_000);
	await registerAs(page, 'admin');
	const target = await insertMember();
	const confirm = await page.request.post(`/admin/users/${target}?/confirmEmail`, {
		form: {},
		headers: ORIGIN
	});
	expect(confirm.ok()).toBe(true);
	const [entry] = await sql`select * from audit_log where entity_id = ${target}`;
	expect(entry.action).toBe('user.email_confirm');

	const ids = {
		userId: target,
		auditId: entry.id,
		mediaId: await insertMedia(target),
		pageId: await insertPage(),
		postId: await insertPost(),
		eventId: await insertEvent(),
		heroId: await insertHero()
	};
	for (const key of Object.keys(ADMIN_READS)) {
		const res = await page.request.get(toPath(key, ids), { maxRedirects: 0 });
		expect(res.status(), `GET ${key}`).toBe(200);
	}
	for (const path of ['/admin/audit', `/admin/audit/${entry.id}`, '/admin/audit/export']) {
		for (const method of ['POST', 'PUT', 'PATCH', 'DELETE']) {
			const res = await page.request.fetch(path, {
				method,
				form: { action: 'changed', id: entry.id },
				headers: ORIGIN,
				maxRedirects: 0
			});
			expect(res.status(), `${method} ${path}`).toBe(405);
		}
	}
	expect(await sql`select * from audit_log where entity_id = ${target}`).toEqual([entry]);
	await sql`update hero_blocks set archived_at = now() where id = ${ids.heroId}`;
});
