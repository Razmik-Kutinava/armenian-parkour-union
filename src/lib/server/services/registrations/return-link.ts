import { and, eq } from 'drizzle-orm';
import type { LimitDb } from '../../auth/rate-limit';
import { events } from '../../db/schema/events';
import { eventRegistrations } from '../../db/schema/registrations';
import { openable } from '../events/public';
import { isUuid } from '../users/target';

/* docs/06 section 9: "Try again" for an event fee leads to the page of its event, if it opens on
 * the site; the event is public, so the return page learns nothing private. */
export async function eventSlugForPayment(db: LimitDb, paymentId: string): Promise<string | null> {
	if (!isUuid(paymentId)) return null;
	const [row] = await db
		.select({ slug: events.slug })
		.from(eventRegistrations)
		.innerJoin(events, eq(events.id, eventRegistrations.eventId))
		.where(and(eq(eventRegistrations.paymentId, paymentId), openable))
		.limit(1);
	return row?.slug ?? null;
}
