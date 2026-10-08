import { and, eq, isNull, sql } from 'drizzle-orm';
import type { LimitDb } from '../../auth/rate-limit';
import { pages } from '../../db/schema/content';
import { users } from '../../db/schema/users';

/*
 * docs/05 section 20: "where a file is used". Every table that stores a media key adds its finder
 * here (posts, events, hero blocks, products — with their tasks), and the code that starts
 * using a file locks its media row FOR SHARE in the same transaction, so a delete cannot slip in.
 */
export type MediaUsage = { kind: 'user_avatar' | 'page'; id: string };

type Finder = (db: LimitDb, key: string) => Promise<MediaUsage[]>;

const avatars: Finder = async (db, key) => {
	const rows = await db
		.select({ id: users.id })
		.from(users)
		.where(and(eq(users.avatarKey, key), isNull(users.deletedAt)));
	return rows.map((r) => ({ kind: 'user_avatar' as const, id: r.id }));
};

/** Images in page text are `src="{R2_PUBLIC_URL}/{key}"`; in jsonb text the quote is `\"`. */
const pageBodies: Finder = async (db, key) => {
	const needle = `/${key}\\"`;
	const rows = await db
		.select({ id: pages.id })
		.from(pages)
		.where(and(sql`strpos(${pages.body}::text, ${needle}) > 0`, isNull(pages.deletedAt)));
	return rows.map((r) => ({ kind: 'page' as const, id: r.id }));
};

const finders: Finder[] = [avatars, pageBodies];

export async function findUsages(db: LimitDb, key: string): Promise<MediaUsage[]> {
	const found: MediaUsage[] = [];
	for (const find of finders) found.push(...(await find(db, key)));
	return found;
}
