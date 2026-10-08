import { isDeepStrictEqual } from 'node:util';
import { and, eq, isNull, sql } from 'drizzle-orm';
import type { PostValues } from '#lib/validation/posts.ts';
import { roleCan } from '../../auth/permissions';
import type { LimitDb } from '../../auth/rate-limit';
import { posts } from '../../db/schema/content';
import { writeAudit } from '../audit';
import { isUuid, type Actor } from '../users/target';
import { authorAllowed, dbNow, lockPostMedia, slugTaken } from './checks';

export { deletePost, duplicatePost, setPostStatus } from './lifecycle';

type Refusal = 'not_allowed' | 'not_found' | 'slug_taken' | 'bad_author' | 'bad_cover';

const LOGGED = [
	'slug',
	'title',
	'excerpt',
	'tags',
	'coverKey',
	'status',
	'publishedAt',
	'authorId'
] as const;

export async function createPost(
	db: LimitDb,
	actor: Actor,
	values: PostValues,
	ip: string | null
): Promise<{ id: string } | Exclude<Refusal, 'not_found'>> {
	if (!roleCan(actor.role, 'posts.write')) return 'not_allowed';
	return db.transaction(async (tx) => {
		if (await slugTaken(tx, values.slug)) return 'slug_taken' as const;
		const authorId = values.authorId ?? actor.id;
		if (values.authorId && !(await authorAllowed(tx, authorId))) return 'bad_author' as const;
		if (!(await lockPostMedia(tx, values.coverKey, values.body))) return 'bad_cover' as const;
		const publishedAt = values.publishedAt ?? (values.status === 'published' ? sql`now()` : null);
		const [row] = await tx
			.insert(posts)
			.values({ ...values, authorId, publishedAt })
			.returning({ id: posts.id, publishedAt: posts.publishedAt });
		const { slug, title, status } = values;
		await writeAudit(tx, {
			actorId: actor.id,
			action: 'post.create',
			entityType: 'post',
			entityId: row.id,
			after: { slug, title, status, publishedAt: row.publishedAt },
			ip
		});
		return { id: row.id };
	});
}

/** A published post saved with an empty date keeps its date (or gets now, if it had none). */
export async function updatePost(
	db: LimitDb,
	actor: Actor,
	id: string,
	values: PostValues,
	ip: string | null
): Promise<'ok' | Refusal> {
	if (!roleCan(actor.role, 'posts.write')) return 'not_allowed';
	if (!isUuid(id)) return 'not_found';
	return db.transaction(async (tx) => {
		const [post] = await tx
			.select()
			.from(posts)
			.where(and(eq(posts.id, id), isNull(posts.deletedAt)))
			.for('update');
		if (!post) return 'not_found' as const;
		if (values.slug !== post.slug && (await slugTaken(tx, values.slug, post.id))) {
			return 'slug_taken' as const;
		}
		const authorId = values.authorId ?? post.authorId;
		if (authorId !== post.authorId && !(await authorAllowed(tx, authorId!))) {
			return 'bad_author' as const;
		}
		const keepDate = values.status === 'published' ? (post.publishedAt ?? (await dbNow(tx))) : null;
		const next = { ...values, authorId, publishedAt: values.publishedAt ?? keepDate };
		const before: Record<string, unknown> = {};
		const after: Record<string, unknown> = {};
		for (const key of LOGGED) {
			if (isDeepStrictEqual(post[key], next[key])) continue;
			before[key] = post[key];
			after[key] = next[key];
		}
		const bodyChanged = !isDeepStrictEqual(post.body, next.body);
		if (!bodyChanged && Object.keys(after).length === 0) return 'ok' as const;
		if (!(await lockPostMedia(tx, next.coverKey, next.body))) return 'bad_cover' as const;
		await tx.update(posts).set(next).where(eq(posts.id, post.id));
		await writeAudit(tx, {
			actorId: actor.id,
			action: 'post.update',
			entityType: 'post',
			entityId: post.id,
			before,
			after: bodyChanged ? { ...after, bodyChanged: true } : after,
			ip
		});
		return 'ok' as const;
	});
}
