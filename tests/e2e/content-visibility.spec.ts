import { existsSync } from 'node:fs';
import { expect, test, type APIRequestContext } from '@playwright/test';
import postgres from 'postgres';

if (!process.env.DATABASE_URL && existsSync('.env')) process.loadEnvFile('.env');
const sql = postgres(process.env.DATABASE_URL ?? '', { max: 1, onnotice: () => {} });
test.afterAll(() => sql.end());
/* Only sign-up counters: auth.spec.ts runs in parallel and checks the sign-in limit. */
test.beforeEach(async () => {
	await sql`delete from rate_limit where key ~ '^sign-up:ip:(127\.0\.0\.1|::1|::ffff:127\.0\.0\.1)$'`;
});

/* Stage 2 (docs/09, 2.11): what a guest gets over HTTP — the page, the lists and the sitemap. */
const uid = () => crypto.randomUUID().slice(0, 8);
const text = async (request: APIRequestContext, path: string) => (await request.get(path)).text();
const status = async (request: APIRequestContext, path: string) =>
	(await request.get(path)).status();
const softDelete = (prefix: string) =>
	Promise.all([
		sql`update pages set deleted_at = now() where slug like ${`${prefix}%`} and deleted_at is null`,
		sql`update posts set deleted_at = now() where slug like ${`${prefix}%`} and deleted_at is null`,
		sql`update events set deleted_at = now() where slug like ${`${prefix}%`} and deleted_at is null`
	]);

/** Each row is titled "Title {its slug}"; the post is tagged and the event placed in `city`. */
async function addContent(slug: string, status: string, publishedAt: string, city: string) {
	const title = (kind: string) => sql.json({ en: `Title ${slug}-${kind}` });
	await sql`insert into pages (slug, title, status)
		values (${`${slug}-page`}, ${title('page')}, ${status})`;
	await sql`insert into posts (slug, title, tags, status, published_at) values
		(${`${slug}-post`}, ${title('post')}, ${[city]}, ${status}, ${publishedAt}::timestamptz)`;
	await sql`insert into events (slug, title, status, published_at, starts_at, ends_at, city) values
		(${`${slug}-event`}, ${title('event')}, ${status}, ${publishedAt}::timestamptz,
		now() + interval '10 days', now() + interval '11 days', ${city})`;
}

test('drafts, archived and deleted content is hidden from guests; published is shown', async ({
	request
}) => {
	const tag = `e2e-vis-${uid()}`;
	const variants = ['published', 'draft', 'archived', 'deleted'];
	const past = new Date(Date.now() - 3_600_000).toISOString();
	for (const v of variants) {
		await addContent(`${tag}-${v}`, v === 'deleted' ? 'published' : v, past, tag);
	}
	await softDelete(`${tag}-deleted`);
	try {
		const news = await text(request, `/news?tag=${tag}`);
		const events = await text(request, `/events?city=${tag}`);
		const sitemap = await text(request, '/sitemap.xml');
		for (const v of variants) {
			const slug = `${tag}-${v}`;
			const code = v === 'published' ? 200 : 404;
			expect(await status(request, `/pages/${slug}-page`), `page ${v}`).toBe(code);
			expect(await status(request, `/news/${slug}-post`), `post ${v}`).toBe(code);
			expect(await status(request, `/events/${slug}-event`), `event ${v}`).toBe(code);
			expect(news.includes(`Title ${slug}-post`), `news list ${v}`).toBe(v === 'published');
			expect(events.includes(`Title ${slug}-event`), `events list ${v}`).toBe(v === 'published');
			for (const path of [`/pages/${slug}-page`, `/news/${slug}-post`, `/events/${slug}-event`]) {
				expect(sitemap.includes(`${path}</loc>`), `sitemap ${path}`).toBe(v === 'published');
			}
		}
	} finally {
		await softDelete(tag);
	}
});

test('a post and an event with a future publish date appear only when the date comes', async ({
	request
}) => {
	const tag = `e2e-vis-${uid()}`;
	await addContent(tag, 'published', new Date(Date.now() + 3_600_000).toISOString(), tag);
	const seen = async () => ({
		post: await status(request, `/news/${tag}-post`),
		event: await status(request, `/events/${tag}-event`),
		newsList: (await text(request, `/news?tag=${tag}`)).includes(`Title ${tag}-post`),
		eventsList: (await text(request, `/events?city=${tag}`)).includes(`Title ${tag}-event`),
		sitemap: (await text(request, '/sitemap.xml')).includes(`/news/${tag}-post</loc>`)
	});
	try {
		expect(await seen()).toEqual({
			post: 404,
			event: 404,
			newsList: false,
			eventsList: false,
			sitemap: false
		});
		await sql`update posts set published_at = now() - interval '1 minute' where slug = ${`${tag}-post`}`;
		await sql`update events set published_at = now() - interval '1 minute' where slug = ${`${tag}-event`}`;
		expect(await seen()).toEqual({
			post: 200,
			event: 200,
			newsList: true,
			eventsList: true,
			sitemap: true
		});
	} finally {
		await softDelete(tag);
	}
});

test('an event block leaves the home page when the editor unpublishes its event', async ({
	page,
	request
}) => {
	test.setTimeout(90_000);
	const tag = `e2e-vis-${uid()}`;
	await addContent(tag, 'published', new Date(Date.now() - 3_600_000).toISOString(), tag);
	const [event] = await sql`select id from events where slug = ${`${tag}-event`}`;
	/* "E2e hero" in the title: hero.spec.ts cleans such blocks; -999 keeps its own blocks first. */
	const heading = `E2e hero visibility ${uid()}`;
	const [block] = await sql`insert into hero_blocks (type, title, event_id, is_active, sort_order)
		values ('event', ${sql.json({ en: heading })}, ${event.id}, true, -999) returning id`;
	try {
		/* Every slide is rendered on the server; the ones not shown are only `hidden`. */
		expect(await text(request, '/')).toContain(heading);

		const email = `e2e-vis-editor-${crypto.randomUUID()}@example.com`;
		await page.goto('/register');
		await page.getByLabel('Email').fill(email);
		await page.getByLabel('Password').fill('parkour-pass-1');
		await page.getByLabel('First name').fill('Visibility');
		await page.getByLabel('Last name').fill('Editor');
		await page.getByLabel('Date of birth').fill('1990-01-01');
		await page.getByLabel(/privacy policy/).check();
		await page.getByRole('button', { name: 'Create account' }).click();
		await expect(page).toHaveURL('/cabinet', { timeout: 15_000 });
		await sql`update users set role = 'editor' where email = ${email}`;

		await page.goto(`/admin/events/${event.id}`);
		await page.getByRole('button', { name: 'Unpublish' }).click();
		await expect(page.getByRole('button', { name: 'Publish' })).toBeVisible();
		expect((await sql`select status from events where id = ${event.id}`)[0].status).toBe('draft');

		expect(await text(request, '/')).not.toContain(heading);
		expect((await sql`select is_active from hero_blocks where id = ${block.id}`)[0].is_active).toBe(
			true
		);
	} finally {
		await sql`update hero_blocks set is_active = false, archived_at = now() where id = ${block.id}`;
		await softDelete(tag);
	}
});
