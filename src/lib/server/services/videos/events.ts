import { and, desc, inArray, isNull, lte } from 'drizzle-orm';
import type { LimitDb } from '../../auth/rate-limit';
import { events } from '../../db/schema/events';

/* docs/06 section 5.7: a video may point to an event that is shown and has already started. */

const OPTIONS_LIMIT = 50;

export const startedShownEvent = (now: Date) =>
	and(
		isNull(events.deletedAt),
		inArray(events.status, ['published', 'finished']),
		lte(events.publishedAt, now),
		lte(events.startsAt, now)
	);

/** Choices for the form: the latest started events first. */
export async function videoEventOptions(db: LimitDb, now = new Date()) {
	return db
		.select({ id: events.id, title: events.title, startsAt: events.startsAt })
		.from(events)
		.where(startedShownEvent(now))
		.orderBy(desc(events.startsAt))
		.limit(OPTIONS_LIMIT);
}
