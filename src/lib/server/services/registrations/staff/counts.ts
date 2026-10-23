import { count, inArray } from 'drizzle-orm';
import type { LimitDb } from '../../../auth/rate-limit';
import { eventRegistrations } from '../../../db/schema/registrations';
import { SEAT_STATUSES } from '../seats';

export type RegistrationCounts = { seats: number; waitlist: number };

/** "Registrations / limit" in the event lists: seats held (unpaid too) and the waitlist. */
export async function registrationCounts(
	db: LimitDb,
	eventIds: string[]
): Promise<Map<string, RegistrationCounts>> {
	const counts = new Map<string, RegistrationCounts>();
	if (eventIds.length === 0) return counts;
	const rows = await db
		.select({ eventId: eventRegistrations.eventId, status: eventRegistrations.status, n: count() })
		.from(eventRegistrations)
		.where(inArray(eventRegistrations.eventId, eventIds))
		.groupBy(eventRegistrations.eventId, eventRegistrations.status);
	for (const { eventId, status, n } of rows) {
		const entry = counts.get(eventId) ?? { seats: 0, waitlist: 0 };
		if (SEAT_STATUSES.includes(status)) entry.seats += n;
		if (status === 'waitlist') entry.waitlist += n;
		counts.set(eventId, entry);
	}
	return counts;
}
