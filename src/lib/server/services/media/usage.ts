import { and, eq, isNull, or, sql } from 'drizzle-orm';
import type { LimitDb } from '../../auth/rate-limit';
import { pages, posts } from '../../db/schema/content';
import { events } from '../../db/schema/events';
import { heroBlocks } from '../../db/schema/hero';
import { shopItems } from '../../db/schema/shop';
import { courseLessons } from '../../db/schema/training';
import { practiceTasks } from '../../db/schema/training-progress';
import { users } from '../../db/schema/users';
import { volunteerPartners } from '../../db/schema/volunteer-partners';

/*
 * docs/05 section 20: "where a file is used". Every table that stores a media key adds its finder
 * here (events, hero blocks, products — with their tasks), and the code that starts
 * using a file locks its media row FOR SHARE in the same transaction, so a delete cannot slip in.
 */
export type MediaUsage = {
	kind:
		| 'user_avatar'
		| 'page'
		| 'post'
		| 'event'
		| 'hero'
		| 'shop_item'
		| 'course_lesson'
		| 'practice_task'
		| 'volunteer_partner';
	id: string;
	/** A lesson or a practice task opens inside its course. */
	courseId?: string;
};

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

/** Archived blocks too: they can be restored with their background. */
const heroBackgrounds: Finder = async (db, key) => {
	const rows = await db
		.select({ id: heroBlocks.id })
		.from(heroBlocks)
		.where(eq(heroBlocks.mediaKey, key));
	return rows.map((r) => ({ kind: 'hero' as const, id: r.id }));
};

/** Archived items too: they can be restored with their photos. */
const itemPhotosAndDescriptions: Finder = async (db, key) => {
	const rows = await db
		.select({ id: shopItems.id })
		.from(shopItems)
		.where(
			and(
				or(
					sql`${shopItems.imageKeys} ? ${key}`,
					sql`strpos(${shopItems.description}::text, ${inText(key)}) > 0`
				),
				isNull(shopItems.deletedAt)
			)
		);
	return rows.map((r) => ({ kind: 'shop_item' as const, id: r.id }));
};

const lessonBodies: Finder = async (db, key) => {
	const rows = await db
		.select({ id: courseLessons.id, courseId: courseLessons.courseId })
		.from(courseLessons)
		.where(
			and(
				sql`strpos(${courseLessons.body}::text, ${inText(key)}) > 0`,
				isNull(courseLessons.deletedAt)
			)
		);
	return rows.map((r) => ({ kind: 'course_lesson' as const, id: r.id, courseId: r.courseId }));
};

/** Hidden tasks too: tasks are never deleted, a hidden one comes back with its description. */
const taskDescriptions: Finder = async (db, key) => {
	const rows = await db
		.select({ id: practiceTasks.id, courseId: practiceTasks.courseId })
		.from(practiceTasks)
		.where(sql`strpos(${practiceTasks.description}::text, ${inText(key)}) > 0`);
	return rows.map((r) => ({ kind: 'practice_task' as const, id: r.id, courseId: r.courseId }));
};

/** Archived partners too: they can be published again with their logo. */
const partnerLogos: Finder = async (db, key) => {
	const rows = await db
		.select({ id: volunteerPartners.id })
		.from(volunteerPartners)
		.where(eq(volunteerPartners.logoKey, key));
	return rows.map((r) => ({ kind: 'volunteer_partner' as const, id: r.id }));
};

const finders: Finder[] = [
	avatars,
	pageBodies,
	postCoversAndBodies,
	eventCoversAndDescriptions,
	heroBackgrounds,
	itemPhotosAndDescriptions,
	lessonBodies,
	taskDescriptions,
	partnerLogos
];

export async function findUsages(db: LimitDb, key: string): Promise<MediaUsage[]> {
	const found: MediaUsage[] = [];
	for (const find of finders) found.push(...(await find(db, key)));
	return found;
}
