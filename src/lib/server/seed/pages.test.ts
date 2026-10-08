import { eq, inArray } from 'drizzle-orm';
import { afterAll, describe, expect, it } from 'vitest';
import { SYSTEM_PAGE_SLUGS } from '#lib/validation/pages.ts';
import { localizedText } from '#lib/validation/site-settings.ts';
import { pages } from '../db/schema/content';
import { testDb, testDbUrl } from '../db/test-db';
import { SEED_PAGES, seedPages } from './pages';

describe('seed: system pages (docs/02 seed, decisions.md 2026-10-08)', () => {
	it('one entry per system page', () => {
		expect(Object.keys(SEED_PAGES).sort()).toEqual([...SYSTEM_PAGE_SLUGS].sort());
	});

	it('titles in all three languages, valid for the admin form', () => {
		for (const [slug, title] of Object.entries(SEED_PAGES)) {
			expect(localizedText(200).safeParse(title).success, slug).toBe(true);
			expect(Object.keys(title).sort(), slug).toEqual(['en', 'hy', 'ru']);
		}
	});
});

describe.skipIf(!testDbUrl)('seed: system pages in the database', () => {
	const { inRollback, close } = testDb();
	afterAll(close);

	it('adds missing pages as system drafts and never touches an edited one', async () => {
		await inRollback(async (tx) => {
			await tx.delete(pages).where(inArray(pages.slug, [...SYSTEM_PAGE_SLUGS]));
			const edited = { en: 'Our rules' };
			await tx.insert(pages).values({
				slug: 'rules',
				title: edited,
				body: { en: '<p>Owner text</p>' },
				status: 'published',
				isSystem: true
			});

			const added = await seedPages(tx);
			expect(added.sort()).toEqual(SYSTEM_PAGE_SLUGS.filter((s) => s !== 'rules').sort());
			const rows = await tx
				.select()
				.from(pages)
				.where(inArray(pages.slug, [...SYSTEM_PAGE_SLUGS]));
			for (const row of rows.filter((r) => r.slug !== 'rules')) {
				expect(row, row.slug).toMatchObject({ status: 'draft', isSystem: true, body: {} });
			}
			const [rules] = await tx.select().from(pages).where(eq(pages.slug, 'rules'));
			expect(rules).toMatchObject({ title: edited, status: 'published' });

			expect(await seedPages(tx)).toEqual([]);
		});
	});
});
