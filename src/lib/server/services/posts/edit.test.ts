import { eq } from 'drizzle-orm';
import { afterAll, describe, expect, it } from 'vitest';
import type { PostValues } from '#lib/validation/posts.ts';
import type { LimitDb } from '../../auth/rate-limit';
import type { UserRole } from '../../auth/session';
import { posts } from '../../db/schema/content';
import { auditLog, media } from '../../db/schema/service';
import { insertUser, testDb, testDbUrl } from '../../db/test-db';
import { createPost, deletePost, duplicatePost, setPostStatus, updatePost } from './edit';
import { getPost } from './list';

const IP = '198.51.100.7';
const values = (slug: string, extra: Partial<PostValues> = {}): PostValues => ({
	slug,
	title: { en: 'Jam' },
	excerpt: { en: 'Short' },
	body: { en: '<p>Text</p>' },
	coverKey: null,
	tags: ['jam'],
	status: 'draft',
	publishedAt: null,
	authorId: null,
	...extra
});

describe.skipIf(!testDbUrl)('posts: admin edits (docs/05 section 18)', () => {
	const { inRollback, close } = testDb();
	afterAll(close);

	const staff = async (tx: LimitDb, role: UserRole = 'editor') => ({
		id: (await insertUser(tx, { role })).id,
		role
	});
	const slug = () => `t-${crypto.randomUUID().slice(0, 8)}`;
	const auditOf = (tx: LimitDb, id: string) =>
		tx.select().from(auditLog).where(eq(auditLog.entityId, id));
	const created = async (tx: LimitDb, actor: { id: string; role: UserRole }, v: PostValues) => {
		const result = await createPost(tx, actor, v, IP);
		if (typeof result === 'string') throw new Error(result);
		return result.id;
	};
	const addMedia = async (tx: LimitDb, mime = 'image/png', deleted = false) => {
		const owner = await insertUser(tx);
		const key = `media/2026/10/${crypto.randomUUID()}.${mime === 'image/png' ? 'png' : 'pdf'}`;
		await tx.insert(media).values({
			key,
			originalName: 'a',
			mime,
			sizeBytes: 10,
			uploadedBy: owner.id,
			deletedAt: deleted ? new Date() : null
		});
		return key;
	};

	it('editor creates a draft; the author is the editor; it is logged', async () => {
		await inRollback(async (tx) => {
			const actor = await staff(tx);
			const s = slug();
			const id = await created(tx, actor, values(s));
			expect(await getPost(tx, id)).toMatchObject({
				slug: s,
				title: { en: 'Jam' },
				excerpt: { en: 'Short' },
				body: { en: '<p>Text</p>' },
				tags: ['jam'],
				status: 'draft',
				publishedAt: null,
				authorId: actor.id
			});
			const [entry] = await auditOf(tx, id);
			expect(entry).toMatchObject({
				action: 'post.create',
				actorId: actor.id,
				entityType: 'post',
				after: { slug: s, title: { en: 'Jam' }, status: 'draft', publishedAt: null },
				ip: IP
			});
		});
	});

	it('published without a date gets now; a future date is kept (scheduled)', async () => {
		await inRollback(async (tx) => {
			const actor = await staff(tx);
			const now = await created(tx, actor, values(slug(), { status: 'published' }));
			const at = (await getPost(tx, now))?.publishedAt;
			expect(at).toBeInstanceOf(Date);
			expect(Math.abs(at!.getTime() - Date.now())).toBeLessThan(60_000);
			const future = new Date(Date.now() + 86_400_000);
			const later = await created(
				tx,
				actor,
				values(slug(), { status: 'published', publishedAt: future })
			);
			expect((await getPost(tx, later))?.publishedAt?.getTime()).toBe(future.getTime());
		});
	});

	it('a taken address is refused, also when the post with it is deleted', async () => {
		await inRollback(async (tx) => {
			const actor = await staff(tx, 'admin');
			const s = slug();
			const id = await created(tx, actor, values(s));
			expect(await createPost(tx, actor, values(s), IP)).toBe('slug_taken');
			expect(await deletePost(tx, actor, id, IP)).toBe('ok');
			expect(await createPost(tx, actor, values(s), IP)).toBe('slug_taken');
			const other = await created(tx, actor, values(slug()));
			expect(await updatePost(tx, actor, other, values(s), IP)).toBe('slug_taken');
		});
	});

	it('author is an active editor or admin', async () => {
		await inRollback(async (tx) => {
			const actor = await staff(tx);
			const colleague = await staff(tx, 'admin');
			const id = await created(tx, actor, values(slug(), { authorId: colleague.id }));
			expect((await getPost(tx, id))?.authorId).toBe(colleague.id);
			const member = await insertUser(tx);
			const blocked = await insertUser(tx, { role: 'editor', status: 'blocked' });
			const gone = await insertUser(tx, { role: 'editor', deletedAt: new Date() });
			for (const authorId of [member.id, blocked.id, gone.id, crypto.randomUUID()]) {
				expect(await createPost(tx, actor, values(slug(), { authorId }), IP)).toBe('bad_author');
				expect(await updatePost(tx, actor, id, values(slug(), { authorId }), IP)).toBe(
					'bad_author'
				);
			}
		});
	});

	it('cover is an image from the library, not deleted', async () => {
		await inRollback(async (tx) => {
			const actor = await staff(tx);
			const image = await addMedia(tx);
			const id = await created(tx, actor, values(slug(), { coverKey: image }));
			expect((await getPost(tx, id))?.coverKey).toBe(image);
			const pdf = await addMedia(tx, 'application/pdf');
			const deleted = await addMedia(tx, 'image/png', true);
			for (const coverKey of [pdf, deleted, `media/2026/10/${crypto.randomUUID()}.png`]) {
				expect(await createPost(tx, actor, values(slug(), { coverKey }), IP)).toBe('bad_cover');
				expect(await updatePost(tx, actor, id, values(slug(), { coverKey }), IP)).toBe('bad_cover');
			}
		});
	});

	it('update saves every field and logs only what changed', async () => {
		await inRollback(async (tx) => {
			const actor = await staff(tx);
			const s = slug();
			const id = await created(tx, actor, values(s));
			const next = values(slug(), {
				title: { en: 'Jam', hy: 'Ջեմ' },
				tags: ['jam', 'kids'],
				body: { en: '<p>New</p>' }
			});
			expect(await updatePost(tx, actor, id, next, IP)).toBe('ok');
			expect(await getPost(tx, id)).toMatchObject({ ...next, authorId: actor.id });
			const updates = (await auditOf(tx, id)).filter((e) => e.action === 'post.update');
			expect(updates).toHaveLength(1);
			expect(updates[0]).toMatchObject({
				before: { slug: s, title: { en: 'Jam' }, tags: ['jam'] },
				after: { slug: next.slug, title: next.title, tags: next.tags, bodyChanged: true }
			});
			expect(updates[0].before).not.toHaveProperty('status');
			expect(await updatePost(tx, actor, id, next, IP)).toBe('ok');
			expect((await auditOf(tx, id)).filter((e) => e.action === 'post.update')).toHaveLength(1);
		});
	});

	it('publish, unpublish and archive change only the status and are logged', async () => {
		await inRollback(async (tx) => {
			const actor = await staff(tx);
			const id = await created(tx, actor, values(slug()));
			expect(await setPostStatus(tx, actor, id, 'published', IP)).toBe('ok');
			const published = await getPost(tx, id);
			expect(published?.status).toBe('published');
			expect(published?.publishedAt).toBeInstanceOf(Date);
			expect(await setPostStatus(tx, actor, id, 'draft', IP)).toBe('ok');
			expect(await setPostStatus(tx, actor, id, 'archived', IP)).toBe('ok');
			const archived = await getPost(tx, id);
			expect(archived).toMatchObject({ status: 'archived', title: { en: 'Jam' } });
			expect(archived?.publishedAt?.getTime()).toBe(published?.publishedAt?.getTime());
			const updates = (await auditOf(tx, id)).filter((e) => e.action === 'post.update');
			expect(updates.map((e) => [e.before, e.after])).toEqual(
				expect.arrayContaining([
					[{ status: 'draft' }, expect.objectContaining({ status: 'published' })],
					[{ status: 'published' }, { status: 'draft' }],
					[{ status: 'draft' }, { status: 'archived' }]
				])
			);
		});
	});

	it('duplicate is a draft copy with a free address and no date', async () => {
		await inRollback(async (tx) => {
			const actor = await staff(tx);
			const s = slug();
			const image = await addMedia(tx);
			const source = await created(
				tx,
				actor,
				values(s, { status: 'published', coverKey: image, tags: ['jam', 'kids'] })
			);
			const first = await duplicatePost(tx, actor, source, IP);
			const second = await duplicatePost(tx, actor, source, IP);
			if (typeof first === 'string' || typeof second === 'string') throw new Error('refused');
			expect(await getPost(tx, first.id)).toMatchObject({
				slug: `${s}-copy`,
				title: { en: 'Jam' },
				body: { en: '<p>Text</p>' },
				coverKey: image,
				tags: ['jam', 'kids'],
				status: 'draft',
				publishedAt: null,
				authorId: actor.id
			});
			expect((await getPost(tx, second.id))?.slug).toBe(`${s}-copy-2`);
			const [entry] = await auditOf(tx, first.id);
			expect(entry).toMatchObject({ action: 'post.create', after: { duplicatedFrom: source } });
		});
	});

	it('delete is soft: row stays, hidden from the admin, logged', async () => {
		await inRollback(async (tx) => {
			const actor = await staff(tx);
			const id = await created(tx, actor, values(slug()));
			expect(await deletePost(tx, actor, id, IP)).toBe('ok');
			const [row] = await tx.select().from(posts).where(eq(posts.id, id));
			expect(row.deletedAt).not.toBeNull();
			expect(await getPost(tx, id)).toBeNull();
			expect((await auditOf(tx, id)).map((e) => e.action).sort()).toEqual([
				'post.create',
				'post.delete'
			]);
			expect(await deletePost(tx, actor, id, IP)).toBe('not_found');
			expect(await updatePost(tx, actor, id, values(slug()), IP)).toBe('not_found');
			expect(await setPostStatus(tx, actor, id, 'published', IP)).toBe('not_found');
			expect(await duplicatePost(tx, actor, id, IP)).toBe('not_found');
		});
	});

	it('moderator and member change nothing', async () => {
		await inRollback(async (tx) => {
			const id = await created(tx, await staff(tx), values(slug()));
			for (const role of ['moderator', 'member'] as const) {
				const actor = await staff(tx, role);
				expect(await createPost(tx, actor, values(slug()), IP)).toBe('not_allowed');
				expect(await updatePost(tx, actor, id, values(slug()), IP)).toBe('not_allowed');
				expect(await setPostStatus(tx, actor, id, 'published', IP)).toBe('not_allowed');
				expect(await duplicatePost(tx, actor, id, IP)).toBe('not_allowed');
				expect(await deletePost(tx, actor, id, IP)).toBe('not_allowed');
			}
			expect((await auditOf(tx, id)).map((e) => e.action)).toEqual(['post.create']);
		});
	});

	it('unknown or malformed id is not found', async () => {
		await inRollback(async (tx) => {
			const actor = await staff(tx);
			expect(await updatePost(tx, actor, 'nope', values(slug()), IP)).toBe('not_found');
			expect(await deletePost(tx, actor, crypto.randomUUID(), IP)).toBe('not_found');
			expect(await getPost(tx, 'nope')).toBeNull();
		});
	});
});
