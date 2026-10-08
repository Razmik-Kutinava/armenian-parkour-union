import { and, eq, isNull, ne, sql } from 'drizzle-orm';
import type { PostText } from '#lib/validation/posts.ts';
import type { LimitDb } from '../../auth/rate-limit';
import { posts } from '../../db/schema/content';
import { media } from '../../db/schema/service';
import { users } from '../../db/schema/users';
import { lockPageMedia } from '../pages/media';
import { authorCondition } from './list';

/** "Publish now" uses the database clock: visibility compares with `now()` there. */
export async function dbNow(tx: LimitDb): Promise<Date> {
	const rows = (await tx.execute(sql`select now()::text as now`)) as unknown as { now: string }[];
	return new Date(rows[0].now);
}

/** Deleted posts keep their address too (unique in the table). */
export async function slugTaken(tx: LimitDb, slug: string, exceptId?: string) {
	const [row] = await tx
		.select({ id: posts.id })
		.from(posts)
		.where(exceptId ? and(eq(posts.slug, slug), ne(posts.id, exceptId)) : eq(posts.slug, slug));
	return !!row;
}

export async function authorAllowed(tx: LimitDb, id: string) {
	const [row] = await tx
		.select({ id: users.id })
		.from(users)
		.where(and(eq(users.id, id), authorCondition));
	return !!row;
}

/**
 * docs/05 section 20: the cover and the text images are locked FOR SHARE, so a parallel delete
 * of the file waits. The cover must be a library image that is not deleted.
 */
export async function lockPostMedia(tx: LimitDb, coverKey: string | null, body: PostText) {
	await lockPageMedia(tx, body);
	if (!coverKey) return true;
	const [row] = await tx
		.select({ mime: media.mime })
		.from(media)
		.where(and(eq(media.key, coverKey), isNull(media.deletedAt)))
		.for('share');
	return !!row && row.mime.startsWith('image/');
}
