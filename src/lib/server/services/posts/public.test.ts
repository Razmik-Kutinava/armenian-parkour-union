import { eq, sql } from 'drizzle-orm';
import { afterAll, describe, expect, it } from 'vitest';
import type { LimitDb } from '../../auth/rate-limit';
import { posts } from '../../db/schema/content';
import { media } from '../../db/schema/service';
import { insertUser, testDb, testDbUrl } from '../../db/test-db';
import { richTextSchema } from '../../rich-text/schema';
import { deleteMedia } from '../media/edit';
import { findUsages } from '../media/usage';
import {
	NEWS_PAGE_SIZE,
	getPostPreview,
	getPublishedPost,
	getRelatedPosts,
	listPublishedPosts
} from './public';

const BASE = 'https://media.parkour.am';
const ago = (seconds: number) => sql`now() - make_interval(secs => ${seconds})` as unknown as Date;

describe.skipIf(!testDbUrl)('posts: public view (docs/06 section 4.4, docs/03 section 12)', () => {
	const { inRollback, close } = testDb();
	afterAll(close);

	const addPost = async (tx: LimitDb, values: Partial<typeof posts.$inferInsert> = {}) => {
		const [row] = await tx
			.insert(posts)
			.values({
				slug: `t-${crypto.randomUUID().slice(0, 8)}`,
				title: { en: 'Jam', ru: 'Джем' },
				excerpt: { en: 'Short' },
				body: { en: '<p>English</p>', hy: '<p>Հայերեն</p>' },
				tags: ['jam'],
				status: 'published',
				publishedAt: ago(60),
				...values
			})
			.returning();
		return row;
	};
	const tag = () => `t-${crypto.randomUUID().slice(0, 8)}`;

	it('a published post is shown in the language asked, English when it is missing', async () => {
		await inRollback(async (tx) => {
			const post = await addPost(tx);
			expect(await getPublishedPost(tx, post.slug, 'ru')).toMatchObject({
				id: post.id,
				slug: post.slug,
				title: 'Джем',
				excerpt: 'Short',
				html: '<p>English</p>',
				tags: ['jam'],
				coverKey: null,
				coverAlt: ''
			});
			expect((await getPublishedPost(tx, post.slug, 'hy'))?.html).toBe('<p>Հայերեն</p>');
		});
	});

	it('draft, archived, deleted, scheduled and dateless posts are hidden everywhere', async () => {
		await inRollback(async (tx) => {
			const t = tag();
			const hidden = [
				await addPost(tx, { tags: [t], status: 'draft' }),
				await addPost(tx, { tags: [t], status: 'archived' }),
				await addPost(tx, { tags: [t], deletedAt: new Date() }),
				await addPost(tx, { tags: [t], publishedAt: new Date(Date.now() + 3_600_000) }),
				await addPost(tx, { tags: [t], publishedAt: null })
			];
			for (const post of hidden) {
				expect(await getPublishedPost(tx, post.slug, 'en'), post.status).toBeNull();
			}
			expect(await listPublishedPosts(tx, { locale: 'en', tag: t, page: 1 })).toEqual({
				rows: [],
				total: 0
			});
			const ids = (await getRelatedPosts(tx, 'none', 'en', 50)).map((p) => p.slug);
			for (const post of hidden) expect(ids).not.toContain(post.slug);
		});
	});

	it('list: newest first, 12 per page, filtered by tag', async () => {
		await inRollback(async (tx) => {
			const t = tag();
			const made = [];
			for (let i = 0; i < NEWS_PAGE_SIZE + 1; i++) {
				made.push(await addPost(tx, { tags: ['jam', t], publishedAt: ago(100 + i) }));
			}
			await addPost(tx, { tags: ['other'] });
			const first = await listPublishedPosts(tx, { locale: 'ru', tag: t, page: 1 });
			expect(NEWS_PAGE_SIZE).toBe(12);
			expect(first.total).toBe(13);
			expect(first.rows.map((r) => r.slug)).toEqual(made.slice(0, 12).map((p) => p.slug));
			expect(first.rows[0]).toMatchObject({ title: 'Джем', excerpt: 'Short', tags: ['jam', t] });
			expect(first.rows[0]).not.toHaveProperty('html');
			const second = await listPublishedPosts(tx, { locale: 'en', tag: t, page: 2 });
			expect(second.rows.map((r) => r.slug)).toEqual([made[12].slug]);
		});
	});

	it('related: the latest visible posts except the one shown', async () => {
		await inRollback(async (tx) => {
			const shown = await addPost(tx, { publishedAt: ago(0) });
			const a = await addPost(tx, { publishedAt: ago(1) });
			const b = await addPost(tx, { publishedAt: ago(2) });
			await addPost(tx, { publishedAt: ago(1), status: 'draft' });
			const related = await getRelatedPosts(tx, shown.slug, 'en', 2);
			expect(related.map((p) => p.slug)).toEqual([a.slug, b.slug]);
		});
	});

	it('cover alt comes from the media library in the language asked', async () => {
		await inRollback(async (tx) => {
			const owner = await insertUser(tx);
			const key = `media/2026/10/${crypto.randomUUID()}.png`;
			await tx.insert(media).values({
				key,
				originalName: 'a.png',
				mime: 'image/png',
				sizeBytes: 10,
				uploadedBy: owner.id,
				alt: { en: 'Jumper', ru: 'Прыжок' }
			});
			const post = await addPost(tx, { coverKey: key });
			expect(await getPublishedPost(tx, post.slug, 'ru')).toMatchObject({
				coverKey: key,
				coverAlt: 'Прыжок'
			});
			expect((await getPublishedPost(tx, post.slug, 'hy'))?.coverAlt).toBe('Jumper');
		});
	});

	it('preview shows a saved post in any status, except a deleted one', async () => {
		await inRollback(async (tx) => {
			const draft = await addPost(tx, { status: 'draft', publishedAt: null });
			expect(await getPostPreview(tx, draft.id, 'en')).toMatchObject({ slug: draft.slug });
			const deleted = await addPost(tx, { deletedAt: new Date() });
			expect(await getPostPreview(tx, deleted.id, 'en')).toBeNull();
			expect(await getPostPreview(tx, 'nope', 'en')).toBeNull();
		});
	});
});

describe.skipIf(!testDbUrl)(
	'posts: media used as cover or in the text (docs/05 section 20)',
	() => {
		const { inRollback, close } = testDb();
		afterAll(close);

		it('a cover or a text image is in use and cannot be deleted; a deleted post frees it', async () => {
			await inRollback(async (tx) => {
				const editor = await insertUser(tx, { role: 'editor' });
				const file = async () => {
					const key = `media/2026/10/${crypto.randomUUID()}.png`;
					const [row] = await tx
						.insert(media)
						.values({
							key,
							originalName: 'a.png',
							mime: 'image/png',
							sizeBytes: 10,
							uploadedBy: editor.id
						})
						.returning();
					return row;
				};
				const cover = await file();
				const inText = await file();
				const [post] = await tx
					.insert(posts)
					.values({
						slug: `t-${crypto.randomUUID().slice(0, 8)}`,
						title: { en: 'Gallery' },
						coverKey: cover.key,
						body: {
							ru: richTextSchema(BASE).parse(`<p><img src="${BASE}/${inText.key}" alt=""></p>`)
						}
					})
					.returning();

				const actor = { id: editor.id, role: 'editor' as const };
				for (const f of [cover, inText]) {
					expect(await findUsages(tx, f.key)).toEqual([{ kind: 'post', id: post.id }]);
					expect(await deleteMedia(tx, actor, f.id, null)).toEqual({
						inUse: [{ kind: 'post', id: post.id }]
					});
				}
				await tx.update(posts).set({ deletedAt: new Date() }).where(eq(posts.id, post.id));
				expect(await findUsages(tx, cover.key)).toEqual([]);
				expect(await findUsages(tx, inText.key)).toEqual([]);
			});
		});
	}
);
