import { afterAll, describe, expect, it } from 'vitest';
import { readListState } from '#lib/components/admin/list-state.ts';
import type { LimitDb } from '../../auth/rate-limit';
import { posts } from '../../db/schema/content';
import { insertUser, testDb, testDbUrl } from '../../db/test-db';
import { listAuthors, listPosts, postListOptions } from './list';

const state = (query: string) => readListState(new URLSearchParams(query), postListOptions);

describe.skipIf(!testDbUrl)('posts: admin list (docs/05 section 18)', () => {
	const { inRollback, close } = testDb();
	afterAll(close);

	const add = async (tx: LimitDb, values: Partial<typeof posts.$inferInsert>) => {
		const [row] = await tx
			.insert(posts)
			.values({ slug: `t-${crypto.randomUUID().slice(0, 8)}`, title: { en: 'Jam' }, ...values })
			.returning();
		return row;
	};

	it('filters by status (scheduled apart), tag, period; searches the title; shows the author', async () => {
		await inRollback(async (tx) => {
			const t = `t-${crypto.randomUUID().slice(0, 8)}`;
			const author = await insertUser(tx, { role: 'editor', name: 'Ani Editor' });
			const draft = await add(tx, { tags: [t], authorId: author.id });
			const live = await add(tx, {
				tags: [t],
				status: 'published',
				publishedAt: new Date('2026-03-10T10:00:00Z'),
				title: { en: 'Spring jam', ru: 'Весенний джем' }
			});
			const scheduled = await add(tx, {
				tags: [t],
				status: 'published',
				publishedAt: new Date(Date.now() + 86_400_000)
			});
			const archived = await add(tx, { tags: [t], status: 'archived' });
			await add(tx, { tags: [t], deletedAt: new Date() });

			const slugs = async (q: string) =>
				(await listPosts(tx, state(`tag=${t}&${q}`))).rows.map((r) => r.slug).sort();

			expect(await slugs('')).toEqual([draft, live, scheduled, archived].map((p) => p.slug).sort());
			expect(await slugs('status=draft')).toEqual([draft.slug]);
			expect(await slugs('status=published')).toEqual([live.slug]);
			expect(await slugs('status=scheduled')).toEqual([scheduled.slug]);
			expect(await slugs('status=archived')).toEqual([archived.slug]);
			expect(await slugs('status=bogus')).toHaveLength(4);
			expect(await slugs('from=2026-03-01&to=2026-03-31')).toEqual([live.slug]);
			expect(await slugs('from=2026-03-11')).toEqual([scheduled.slug]);
			expect(await slugs('q=весенний')).toEqual([live.slug]);
			expect(await slugs('q=%25')).toEqual([]);
			expect(await slugs('from=2026-13-45&to=2026-02-30')).toHaveLength(4);

			const { rows, total } = await listPosts(tx, state(`tag=${t}&status=draft`));
			expect(total).toBe(1);
			expect(rows[0]).toMatchObject({ id: draft.id, authorName: 'Ani Editor', scheduled: false });
			const [sched] = (await listPosts(tx, state(`tag=${t}&status=scheduled`))).rows;
			expect(sched.scheduled).toBe(true);
		});
	});

	it('authors to choose from: active editors and admins only', async () => {
		await inRollback(async (tx) => {
			const editor = await insertUser(tx, { role: 'editor' });
			const admin = await insertUser(tx, { role: 'admin' });
			const member = await insertUser(tx);
			const moderator = await insertUser(tx, { role: 'moderator' });
			const blocked = await insertUser(tx, { role: 'editor', status: 'blocked' });
			const gone = await insertUser(tx, { role: 'admin', deletedAt: new Date() });
			const ids = (await listAuthors(tx)).map((a) => a.id);
			expect(ids).toEqual(expect.arrayContaining([editor.id, admin.id]));
			for (const u of [member, moderator, blocked, gone]) expect(ids).not.toContain(u.id);
		});
	});
});
