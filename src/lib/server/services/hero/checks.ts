import { and, asc, eq, isNull, ne, sql } from 'drizzle-orm';
import type { HeroValues } from '#lib/validation/hero.ts';
import type { LimitDb } from '../../auth/rate-limit';
import { events } from '../../db/schema/events';
import { heroBlocks } from '../../db/schema/hero';
import { siteSettings } from '../../db/schema/service';
import { users } from '../../db/schema/users';
import { lockPostMedia } from '../posts/checks';
import { adultPerson } from './persons';

/* docs/03 section 11, docs/05 section 4; rules — docs/todo.md 2.6. */

export const HERO_LIMIT_DEFAULT = 5;

export async function heroLimit(db: LimitDb): Promise<number> {
	const [row] = await db
		.select({ value: siteSettings.value })
		.from(siteSettings)
		.where(eq(siteSettings.key, 'hero_max_active'));
	const value = row?.value;
	return typeof value === 'number' && Number.isInteger(value) && value >= 1
		? value
		: HERO_LIMIT_DEFAULT;
}

/** Two switches at once cannot both take the last place: they wait on one lock. */
export async function roomForActive(tx: LimitDb, exceptId?: string): Promise<boolean> {
	await tx.execute(sql`select pg_advisory_xact_lock(hashtext('hero_blocks_active'))`);
	const where = and(
		eq(heroBlocks.isActive, true),
		isNull(heroBlocks.archivedAt),
		exceptId ? ne(heroBlocks.id, exceptId) : undefined
	);
	const [{ n }] = await tx
		.select({ n: sql<number>`count(*)::int` })
		.from(heroBlocks)
		.where(where);
	return n < (await heroLimit(tx));
}

export async function lockHero(tx: LimitDb, id: string) {
	const [row] = await tx.select().from(heroBlocks).where(eq(heroBlocks.id, id)).for('update');
	return row;
}

/** After the last block that is not archived. */
export async function nextSortOrder(tx: LimitDb): Promise<number> {
	const [{ max }] = await tx
		.select({ max: sql<number | null>`max(${heroBlocks.sortOrder})` })
		.from(heroBlocks)
		.where(isNull(heroBlocks.archivedAt));
	return max === null ? 0 : max + 1;
}

/** Ids of blocks that are not archived, in their order (locked for the reorder). */
export async function lockCurrentOrder(tx: LimitDb): Promise<string[]> {
	const rows = await tx
		.select({ id: heroBlocks.id })
		.from(heroBlocks)
		.where(isNull(heroBlocks.archivedAt))
		.orderBy(asc(heroBlocks.sortOrder), asc(heroBlocks.createdAt), asc(heroBlocks.id))
		.for('update');
	return rows.map((r) => r.id);
}

/**
 * Background: a library image, locked FOR SHARE (docs/05 section 20). Event: exists and is not
 * deleted (a draft is allowed, the form warns). Person: an active adult.
 */
export async function checkHeroRefs(
	tx: LimitDb,
	v: HeroValues
): Promise<'ok' | 'bad_media' | 'bad_event' | 'bad_person'> {
	if (!(await lockPostMedia(tx, v.mediaKey, {}))) return 'bad_media';
	if (v.eventId) {
		const [event] = await tx
			.select({ id: events.id })
			.from(events)
			.where(and(eq(events.id, v.eventId), isNull(events.deletedAt)))
			.for('share');
		if (!event) return 'bad_event';
	}
	if (v.personUserId) {
		const [person] = await tx
			.select({ id: users.id })
			.from(users)
			.where(and(eq(users.id, v.personUserId), adultPerson))
			.for('share');
		if (!person) return 'bad_person';
	}
	return 'ok';
}
