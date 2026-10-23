import { and, asc, eq, inArray, isNull } from 'drizzle-orm';
import type { LocalizedText } from '#lib/i18n/localized.ts';
import { ageOn } from '#lib/validation/auth.ts';
import type { LimitDb } from '../../../auth/rate-limit';
import { eventCategories, events } from '../../../db/schema/events';
import { eventRegistrations } from '../../../db/schema/registrations';
import { users } from '../../../db/schema/users';
import { isUuid } from '../../users/target';
import { YEREVAN_OFFSET, type RegistrationStatus } from '../admission';

/* docs/05 section 5 "Event day" and "Results": who is expected or already marked, by name. Name,
 * age and category only — the day screen is for a moderator's phone (docs/04 section 4). */

export type RosterRow = {
	id: string;
	name: string;
	age: number | null;
	categoryName: LocalizedText | null;
	status: RegistrationStatus;
	place: number | null;
	score: string | null;
};

const ROSTER_MAX = 2000;
const ON_THE_DAY = ['registered', 'attended', 'no_show'] as const;

/** `null` — no such event. */
export async function eventRoster(db: LimitDb, eventId: string): Promise<RosterRow[] | null> {
	if (!isUuid(eventId)) return null;
	const [event] = await db
		.select({ startsAt: events.startsAt })
		.from(events)
		.where(and(eq(events.id, eventId), isNull(events.deletedAt)));
	if (!event) return null;
	const rows = await db
		.select({
			id: eventRegistrations.id,
			name: users.name,
			birthDate: users.birthDate,
			categoryName: eventCategories.name,
			status: eventRegistrations.status,
			place: eventRegistrations.place,
			score: eventRegistrations.score
		})
		.from(eventRegistrations)
		.innerJoin(users, eq(users.id, eventRegistrations.userId))
		.leftJoin(eventCategories, eq(eventCategories.id, eventRegistrations.categoryId))
		.where(
			and(
				eq(eventRegistrations.eventId, eventId),
				inArray(eventRegistrations.status, [...ON_THE_DAY])
			)
		)
		.orderBy(asc(users.name), asc(eventRegistrations.id))
		.limit(ROSTER_MAX);
	const day = new Date(event.startsAt.getTime() + YEREVAN_OFFSET);
	return rows.map(({ birthDate, ...row }) => ({
		...row,
		categoryName: row.categoryName as LocalizedText | null,
		age: birthDate ? ageOn(birthDate, day) : null
	}));
}
