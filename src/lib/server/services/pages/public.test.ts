import { eq, sql } from 'drizzle-orm';
import { afterAll, describe, expect, it } from 'vitest';
import type { LimitDb } from '../../auth/rate-limit';
import { pages } from '../../db/schema/content';
import { media } from '../../db/schema/service';
import { insertUser, testDb, testDbUrl } from '../../db/test-db';
import { deleteMedia } from '../media/edit';
import { findUsages } from '../media/usage';
import { getPublishedPage } from './public';

const BASE = 'https://media.parkour.am';

describe.skipIf(!testDbUrl)('pages: public view (docs/06 section 4.5)', () => {
	const { inRollback, close } = testDb();
	afterAll(close);

	const addPage = async (tx: LimitDb, values: Partial<typeof pages.$inferInsert> = {}) => {
		const [row] = await tx
			.insert(pages)
			.values({
				slug: `t-${crypto.randomUUID().slice(0, 8)}`,
				title: { en: 'Rules', ru: 'Правила' },
				body: { en: '<p>English</p>', hy: '<p>Հայերեն</p>' },
				status: 'published',
				...values
			})
			.returning();
		return row;
	};

	it('a published page is shown in the language asked, English when it is missing', async () => {
		await inRollback(async (tx) => {
			const page = await addPage(tx);
			expect(await getPublishedPage(tx, page.slug, 'ru')).toEqual({
				slug: page.slug,
				title: 'Правила',
				html: '<p>English</p>'
			});
			expect(await getPublishedPage(tx, page.slug, 'hy')).toEqual({
				slug: page.slug,
				title: 'Rules',
				html: '<p>Հայերեն</p>'
			});
		});
	});

	it('a page without text is shown with an empty body', async () => {
		await inRollback(async (tx) => {
			const page = await addPage(tx, { body: {} });
			expect((await getPublishedPage(tx, page.slug, 'en'))?.html).toBe('');
		});
	});

	it('draft, archived, deleted and unknown pages are not shown to anyone', async () => {
		await inRollback(async (tx) => {
			const draft = await addPage(tx, { status: 'draft' });
			const archived = await addPage(tx, { status: 'archived' });
			const deleted = await addPage(tx, { deletedAt: sql`now()` as unknown as Date });
			for (const page of [draft, archived, deleted]) {
				expect(await getPublishedPage(tx, page.slug, 'en'), page.status).toBeNull();
			}
			expect(await getPublishedPage(tx, 'no-such-page-at-all', 'en')).toBeNull();
		});
	});
});

describe.skipIf(!testDbUrl)('pages: media used in the text (docs/05 section 20)', () => {
	const { inRollback, close } = testDb();
	afterAll(close);

	it('a file shown in a page is in use and cannot be deleted; a deleted page frees it', async () => {
		await inRollback(async (tx) => {
			const editor = await insertUser(tx, { role: 'editor' });
			const key = `media/2026/10/${crypto.randomUUID()}.png`;
			const [file] = await tx
				.insert(media)
				.values({
					key,
					originalName: 'a.png',
					mime: 'image/png',
					sizeBytes: 10,
					uploadedBy: editor.id
				})
				.returning();
			const [page] = await tx
				.insert(pages)
				.values({
					slug: `t-${crypto.randomUUID().slice(0, 8)}`,
					title: { en: 'Gallery' },
					body: { hy: `<p><img src="${BASE}/${key}" alt=""></p>` }
				})
				.returning();

			expect(await findUsages(tx, key)).toEqual([{ kind: 'page', id: page.id }]);
			const actor = { id: editor.id, role: 'editor' as const };
			expect(await deleteMedia(tx, actor, file.id, null)).toEqual({
				inUse: [{ kind: 'page', id: page.id }]
			});

			await tx.update(pages).set({ deletedAt: new Date() }).where(eq(pages.id, page.id));
			expect(await findUsages(tx, key)).toEqual([]);
		});
	});
});
