import { sql } from 'drizzle-orm';
import { afterAll, describe, expect, it } from 'vitest';
import type { LimitDb } from '../../auth/rate-limit';
import { pages, posts } from '../../db/schema/content';
import { events } from '../../db/schema/events';
import { shopItems } from '../../db/schema/shop';
import { testDb, testDbUrl } from '../../db/test-db';
import { listSitemapEntries } from './sitemap';

const ago = (seconds: number) => sql`now() - make_interval(secs => ${seconds})` as unknown as Date;
const slug = () => `t-${crypto.randomUUID().slice(0, 8)}`;
const HOUR = 3_600_000;

/* docs/06 section 7.2: only what a guest can open goes to the sitemap. */
describe.skipIf(!testDbUrl)('seo: sitemap addresses from the database', () => {
	const { inRollback, close } = testDb();
	afterAll(close);

	const addPost = async (tx: LimitDb, values: Partial<typeof posts.$inferInsert> = {}) =>
		(
			await tx
				.insert(posts)
				.values({
					slug: slug(),
					title: { en: 'Jam' },
					status: 'published',
					publishedAt: ago(60),
					...values
				})
				.returning()
		)[0];
	const addEvent = async (tx: LimitDb, values: Partial<typeof events.$inferInsert> = {}) =>
		(
			await tx
				.insert(events)
				.values({
					slug: slug(),
					title: { en: 'Jam' },
					status: 'published',
					publishedAt: ago(60),
					startsAt: new Date(Date.now() + 24 * HOUR),
					endsAt: new Date(Date.now() + 30 * HOUR),
					...values
				})
				.returning()
		)[0];
	const addPage = async (tx: LimitDb, values: Partial<typeof pages.$inferInsert> = {}) =>
		(
			await tx
				.insert(pages)
				.values({ slug: slug(), title: { en: 'Page' }, status: 'published', ...values })
				.returning()
		)[0];

	it('lists, visible news, openable events and published pages with their dates', async () => {
		await inRollback(async (tx) => {
			const post = await addPost(tx);
			const upcoming = await addEvent(tx);
			const finished = await addEvent(tx, { status: 'finished' });
			const cancelled = await addEvent(tx, { status: 'cancelled' });
			const page = await addPage(tx);
			const entries = await listSitemapEntries(tx);
			const paths = entries.map((e) => e.path);
			expect(paths.slice(0, 5)).toEqual(['/', '/events', '/events/archive', '/news', '/donate']);
			for (const p of [
				`/news/${post.slug}`,
				`/events/${upcoming.slug}`,
				`/events/${finished.slug}`,
				`/events/${cancelled.slug}`,
				`/pages/${page.slug}`
			]) {
				expect(paths).toContain(p);
			}
			expect(entries.find((e) => e.path === `/news/${post.slug}`)?.lastmod).toEqual(post.updatedAt);
			expect(entries.find((e) => e.path === `/pages/${page.slug}`)?.lastmod).toEqual(
				page.updatedAt
			);
			expect(entries.find((e) => e.path === '/news')?.lastmod).toBeUndefined();
			expect(new Set(paths).size).toBe(paths.length);
		});
	});

	it('drafts, archived, deleted and scheduled content stays out', async () => {
		await inRollback(async (tx) => {
			const hidden = [
				`/news/${(await addPost(tx, { status: 'draft' })).slug}`,
				`/news/${(await addPost(tx, { status: 'archived' })).slug}`,
				`/news/${(await addPost(tx, { deletedAt: new Date() })).slug}`,
				`/news/${(await addPost(tx, { publishedAt: new Date(Date.now() + HOUR) })).slug}`,
				`/news/${(await addPost(tx, { publishedAt: null })).slug}`,
				`/events/${(await addEvent(tx, { status: 'draft' })).slug}`,
				`/events/${(await addEvent(tx, { status: 'archived' })).slug}`,
				`/events/${(await addEvent(tx, { deletedAt: new Date() })).slug}`,
				`/events/${(await addEvent(tx, { publishedAt: new Date(Date.now() + HOUR) })).slug}`,
				`/pages/${(await addPage(tx, { status: 'draft' })).slug}`,
				`/pages/${(await addPage(tx, { status: 'archived' })).slug}`,
				`/pages/${(await addPage(tx, { deletedAt: new Date() })).slug}`
			];
			const paths = (await listSitemapEntries(tx)).map((e) => e.path);
			for (const p of hidden) expect(paths).not.toContain(p);
		});
	});

	it('the shop (docs/06 section 7 item 2): the catalog and published items only', async () => {
		await inRollback(async (tx) => {
			const addItem = async (values: Partial<typeof shopItems.$inferInsert> = {}) =>
				(
					await tx
						.insert(shopItems)
						.values({
							slug: slug(),
							title: { en: 'Tee' },
							pricePoints: 10,
							status: 'published',
							...values
						})
						.returning()
				)[0];
			const item = await addItem();
			const soldOut = await addItem({ stock: 0 });
			const hidden = [
				await addItem({ status: 'draft' }),
				await addItem({ status: 'archived' }),
				await addItem({ deletedAt: new Date() })
			];
			const entries = await listSitemapEntries(tx);
			const paths = entries.map((e) => e.path);
			expect(paths).toContain('/shop');
			expect(paths).toContain(`/shop/${soldOut.slug}`);
			expect(entries.find((e) => e.path === `/shop/${item.slug}`)?.lastmod).toEqual(item.updatedAt);
			for (const h of hidden) expect(paths).not.toContain(`/shop/${h.slug}`);
		});
	});

	it('"About" is listed at /federation, not at /pages/about', async () => {
		await inRollback(async (tx) => {
			await tx.delete(pages).where(sql`${pages.slug} = 'about'`);
			expect((await listSitemapEntries(tx)).map((e) => e.path)).not.toContain('/federation');
			await addPage(tx, { slug: 'about', isSystem: true });
			const paths = (await listSitemapEntries(tx)).map((e) => e.path);
			expect(paths).toContain('/federation');
			expect(paths).not.toContain('/pages/about');
		});
	});

	it('"Join" is listed at /join, not at /pages/join', async () => {
		await inRollback(async (tx) => {
			await tx.delete(pages).where(sql`${pages.slug} = 'join'`);
			await addPage(tx, { slug: 'join', isSystem: true });
			const paths = (await listSitemapEntries(tx)).map((e) => e.path);
			expect(paths).toContain('/join');
			expect(paths).not.toContain('/pages/join');
		});
	});
});
