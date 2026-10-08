import { and, eq, isNull, sql } from 'drizzle-orm';
import { SLUG_MAX } from '#lib/validation/pages.ts';
import type { PostStatus, PostText } from '#lib/validation/posts.ts';
import { roleCan } from '../../auth/permissions';
import type { LimitDb } from '../../auth/rate-limit';
import { posts } from '../../db/schema/content';
import { writeAudit } from '../audit';
import { isUuid, type Actor } from '../users/target';
import { dbNow, lockPostMedia, slugTaken } from './checks';

/* docs/05 section 18: publish, unpublish, archive, duplicate; delete is soft (main.mdc, arch. 5). */

type Missing = 'not_allowed' | 'not_found';

async function lockPost(tx: LimitDb, id: string) {
	const [post] = await tx
		.select()
		.from(posts)
		.where(and(eq(posts.id, id), isNull(posts.deletedAt)))
		.for('update');
	return post;
}

/** Publishing without a date publishes now; other fields and the date stay as they are. */
export async function setPostStatus(
	db: LimitDb,
	actor: Actor,
	id: string,
	status: PostStatus,
	ip: string | null
): Promise<'ok' | Missing> {
	if (!roleCan(actor.role, 'posts.write')) return 'not_allowed';
	if (!isUuid(id)) return 'not_found';
	return db.transaction(async (tx) => {
		const post = await lockPost(tx, id);
		if (!post) return 'not_found' as const;
		if (post.status === status) return 'ok' as const;
		const publishedAt = status === 'published' && !post.publishedAt ? await dbNow(tx) : undefined;
		await tx
			.update(posts)
			.set({ status, ...(publishedAt && { publishedAt }) })
			.where(eq(posts.id, post.id));
		await writeAudit(tx, {
			actorId: actor.id,
			action: 'post.update',
			entityType: 'post',
			entityId: post.id,
			before: { status: post.status },
			after: { status, ...(publishedAt && { publishedAt }) },
			ip
		});
		return 'ok' as const;
	});
}

async function freeCopySlug(tx: LimitDb, slug: string) {
	for (let n = 1; ; n++) {
		const suffix = n === 1 ? '-copy' : `-copy-${n}`;
		const candidate = `${slug.slice(0, SLUG_MAX - suffix.length).replace(/-+$/, '')}${suffix}`;
		if (!(await slugTaken(tx, candidate))) return candidate;
	}
}

/** A draft copy without a date; the one who copies becomes the author. */
export async function duplicatePost(
	db: LimitDb,
	actor: Actor,
	id: string,
	ip: string | null
): Promise<{ id: string } | Missing> {
	if (!roleCan(actor.role, 'posts.write')) return 'not_allowed';
	if (!isUuid(id)) return 'not_found';
	return db.transaction(async (tx) => {
		const source = await lockPost(tx, id);
		if (!source) return 'not_found' as const;
		const slug = await freeCopySlug(tx, source.slug);
		await lockPostMedia(tx, source.coverKey, source.body as PostText);
		const [row] = await tx
			.insert(posts)
			.values({
				slug,
				title: source.title,
				excerpt: source.excerpt,
				body: source.body,
				coverKey: source.coverKey,
				tags: source.tags,
				status: 'draft',
				publishedAt: null,
				authorId: actor.id
			})
			.returning({ id: posts.id });
		await writeAudit(tx, {
			actorId: actor.id,
			action: 'post.create',
			entityType: 'post',
			entityId: row.id,
			after: { slug, title: source.title, status: 'draft', duplicatedFrom: source.id },
			ip
		});
		return { id: row.id };
	});
}

export async function deletePost(
	db: LimitDb,
	actor: Actor,
	id: string,
	ip: string | null
): Promise<'ok' | Missing> {
	if (!roleCan(actor.role, 'posts.write')) return 'not_allowed';
	if (!isUuid(id)) return 'not_found';
	return db.transaction(async (tx) => {
		const post = await lockPost(tx, id);
		if (!post) return 'not_found' as const;
		await tx
			.update(posts)
			.set({ deletedAt: sql`now()` })
			.where(eq(posts.id, post.id));
		await writeAudit(tx, {
			actorId: actor.id,
			action: 'post.delete',
			entityType: 'post',
			entityId: post.id,
			before: { slug: post.slug, status: post.status },
			ip
		});
		return 'ok' as const;
	});
}
