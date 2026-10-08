import { and, eq, isNull, or, sql } from 'drizzle-orm';
import type { LimitDb } from '../../auth/rate-limit';
import { pages, posts } from '../../db/schema/content';
import { events } from '../../db/schema/events';
import { users } from '../../db/schema/users';

/*
 * docs/05 section 20: "where a file is used". Every table that stores a media key adds its finder
 * here (events, hero blocks, products — with their tasks), and the code that starts
 * using a file locks its media row FOR SHARE in the same transaction, so a delete cannot slip in.
 */
export type MediaUsage = { kind: 'user_avatar' | 'page' | 'post' | 'event'; id: string };

type Finder = (db: LimitDb, key: string) => Promise<MediaUsage[]>;

const avatars: Finder = async (db, key) => {
	const rows = await db
		.select({ id: users.id })
		.from(users)
		.where(and(eq(users.avatarKey, key), isNull(users.deletedAt)));
	return rows.map((r) => ({ kind: 'user_avatar' as const, id: r.id }));
};

/** Images in rich text are `src="{R2_PUBLIC_URL}/{key}"`; in jsonb text the quote is `\"`. */
const inText = (key: string) => `/${key}\\"`;

const pageBodies: Finder = async (db, key) => {
	const rows = await db
		.select({ id: pages.id })
		.from(pages)
		.where(and(sql`strpos(${pages.body}::text, ${inText(key)}) > 0`, isNull(pages.deletedAt)));
	return rows.map((r) => ({ kind: 'page' as const, id: r.id }));
};

const postCoversAndBodies: Finder = async (db, key) => {
	const rows = await db
		.select({ id: posts.id })
		.from(posts)
		.where(
			and(
				or(eq(posts.coverKey, key), sql`strpos(${posts.body}::text, ${inText(key)}) > 0`),
				isNull(posts.deletedAt)
			)
		);
	return rows.map((r) => ({ kind: 'post' as const, id: r.id }));
};

const eventCoversAndDescriptions: Finder = async (db, key) => {
	const rows = await db
		.select({ id: events.id })
		.from(events)
		.where(
			and(
				or(eq(events.coverKey, key), sql`strpos(${events.description}::text, ${inText(key)}) > 0`),
				isNull(events.deletedAt)
			)
		);
	return rows.map((r) => ({ kind: 'event' as const, id: r.id }));
};

const finders: Finder[] = [avatars, pageBodies, postCoversAndBodies, eventCoversAndDescriptions];

export async function findUsages(db: LimitDb, key: string): Promise<MediaUsage[]> {
	const found: MediaUsage[] = [];
	for (const find of finders) found.push(...(await find(db, key)));
	return found;
}
