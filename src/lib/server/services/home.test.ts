import { isNull } from 'drizzle-orm';
import { afterAll, describe, expect, it } from 'vitest';
import type { LimitDb } from '../auth/rate-limit';
import { pages, posts } from '../db/schema/content';
import { events } from '../db/schema/events';
import { testDb, testDbUrl } from '../db/test-db';
import { getHomeSections } from './home';

/* docs/06 section 4.1: nearest 3 events, start of "About", latest 3 news; no data — hidden. */

const DAY = 86_400_000;

describe.skipIf(!testDbUrl)('home page sections', () => {
	const { inRollback, close } = testDb();
	afterAll(close);

	const hideAll = async (tx: LimitDb) => {
		await tx.update(events).set({ deletedAt: new Date() }).where(isNull(events.deletedAt));
		await tx.update(posts).set({ deletedAt: new Date() }).where(isNull(posts.deletedAt));
		await tx.update(pages).set({ deletedAt: new Date() }).where(isNull(pages.deletedAt));
	};
	const event = (title: string, inDays: number, status: 'published' | 'draft' = 'published') => ({
		slug: `t-home-${crypto.randomUUID().slice(0, 8)}`,
		title: { en: title },
		status,
		publishedAt: new Date(Date.now() - DAY),
		startsAt: new Date(Date.now() + inDays * DAY),
		endsAt: new Date(Date.now() + inDays * DAY + 3_600_000)
	});
	const post = (title: string, daysAgo: number, status: 'published' | 'draft' = 'published') => ({
		slug: `t-home-${crypto.randomUUID().slice(0, 8)}`,
		title: { en: title },
		status,
		publishedAt: new Date(Date.now() - daysAgo * DAY)
	});

	it('3 nearest upcoming events and 3 latest visible news, drafts left out', async () => {
		await inRollback(async (tx) => {
			await hideAll(tx);
			await tx
				.insert(events)
				.values([
					event('E4', 4),
					event('E1', 1),
					event('E3', 3),
					event('Draft', 0.5, 'draft'),
					event('E2', 2)
				]);
			await tx
				.insert(posts)
				.values([
					post('P4', 4),
					post('P1', 1),
					post('Draft', 0, 'draft'),
					post('P2', 2),
					post('P3', 3)
				]);
			const home = await getHomeSections(tx, 'en');
			expect(home.events.map((e) => e.title)).toEqual(['E1', 'E2', 'E3']);
			expect(home.news.map((p) => p.title)).toEqual(['P1', 'P2', 'P3']);
		});
	});

	it('"About the federation": title and the start of the text without HTML, only when published', async () => {
		await inRollback(async (tx) => {
			await hideAll(tx);
			const long = 'Parkour federation. '.repeat(40);
			await tx
				.insert(pages)
				.values({
					slug: 'about',
					title: { en: 'About us', ru: 'О нас' },
					body: { en: `<h2>Who</h2><p>${long}</p>` },
					status: 'published',
					isSystem: true
				})
				.onConflictDoUpdate({
					target: pages.slug,
					set: {
						title: { en: 'About us', ru: 'О нас' },
						body: { en: `<h2>Who</h2><p>${long}</p>` },
						status: 'published',
						deletedAt: null
					}
				});
			const home = await getHomeSections(tx, 'ru');
			expect(home.about?.title).toBe('О нас');
			expect(home.about?.excerpt.startsWith('Who Parkour federation.')).toBe(true);
			expect(home.about?.excerpt).not.toContain('<');
			expect(home.about!.excerpt.length).toBeLessThanOrEqual(301);
			await tx.update(pages).set({ status: 'draft' });
			expect((await getHomeSections(tx, 'en')).about).toBeNull();
		});
	});

	it('nothing to show: empty lists and no "About"', async () => {
		await inRollback(async (tx) => {
			await hideAll(tx);
			expect(await getHomeSections(tx, 'en')).toEqual({ events: [], news: [], about: null });
		});
	});
});
