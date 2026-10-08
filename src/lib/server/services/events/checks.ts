import { and, eq, isNull, ne } from 'drizzle-orm';
import { SLUG_MAX } from '#lib/validation/pages.ts';
import type { LimitDb } from '../../auth/rate-limit';
import { events } from '../../db/schema/events';

export { dbNow, lockPostMedia as lockEventMedia } from '../posts/checks';

/** Deleted events keep their address too (unique in the table). */
export async function slugTaken(tx: LimitDb, slug: string, exceptId?: string) {
	const [row] = await tx
		.select({ id: events.id })
		.from(events)
		.where(exceptId ? and(eq(events.slug, slug), ne(events.id, exceptId)) : eq(events.slug, slug));
	return !!row;
}

export async function freeCopySlug(tx: LimitDb, slug: string) {
	for (let n = 1; ; n++) {
		const suffix = n === 1 ? '-copy' : `-copy-${n}`;
		const candidate = `${slug.slice(0, SLUG_MAX - suffix.length).replace(/-+$/, '')}${suffix}`;
		if (!(await slugTaken(tx, candidate))) return candidate;
	}
}

export async function lockEvent(tx: LimitDb, id: string) {
	const [event] = await tx
		.select()
		.from(events)
		.where(and(eq(events.id, id), isNull(events.deletedAt)))
		.for('update');
	return event;
}
