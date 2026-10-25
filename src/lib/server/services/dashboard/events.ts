import { and, asc, eq, gte, inArray, isNull, sql } from 'drizzle-orm';
import type { LocalizedText } from '#lib/i18n/localized.ts';
import type { HeroType } from '#lib/validation/hero-enums.ts';
import { roleCan } from '../../auth/permissions';
import type { LimitDb } from '../../auth/rate-limit';
import { events } from '../../db/schema/events';
import { heroBlocks } from '../../db/schema/hero';
import { shownHeroIds } from '../hero/public';
import { registrationCounts } from '../registrations/staff/counts';
import type { Actor } from '../users/target';

/* docs/05 section 3: "Upcoming events" (every staff role) and "Home page now" (hero.write). */

export type UpcomingEvent = {
	id: string;
	title: LocalizedText;
	startsAt: Date;
	endsAt: Date;
	/** `null` — no limit. */
	capacity: number | null;
	seats: number;
	waitlist: number;
	/** Registrations for those who manage them, else the event form; `null` — neither. */
	href: string | null;
};

export type HeroNow = { id: string; type: HeroType; title: LocalizedText };

const UPCOMING = 3;

function eventHref(viewer: Actor, id: string): string | null {
	if (roleCan(viewer.role, 'registrations.read')) return `/admin/registrations/${id}`;
	if (roleCan(viewer.role, 'events.write')) return `/admin/events/${id}`;
	return null;
}

/** Published, not deleted and not ended yet, nearest start first. */
export async function upcomingEvents(db: LimitDb, viewer: Actor): Promise<UpcomingEvent[]> {
	const rows = await db
		.select({
			id: events.id,
			title: events.title,
			startsAt: events.startsAt,
			endsAt: events.endsAt,
			capacity: events.capacity
		})
		.from(events)
		.where(
			and(eq(events.status, 'published'), isNull(events.deletedAt), gte(events.endsAt, sql`now()`))
		)
		.orderBy(asc(events.startsAt), asc(events.id))
		.limit(UPCOMING);
	const counts = await registrationCounts(
		db,
		rows.map((r) => r.id)
	);
	return rows.map((r) => ({
		...r,
		title: r.title as LocalizedText,
		...(counts.get(r.id) ?? { seats: 0, waitlist: 0 }),
		href: eventHref(viewer, r.id)
	}));
}

/** The blocks the home page shows now, in their order. */
export async function heroNow(db: LimitDb): Promise<HeroNow[]> {
	const ids = await shownHeroIds(db);
	if (ids.length === 0) return [];
	const rows = await db
		.select({ id: heroBlocks.id, type: heroBlocks.type, title: heroBlocks.title })
		.from(heroBlocks)
		.where(inArray(heroBlocks.id, ids));
	const byId = new Map(rows.map((r) => [r.id, { ...r, title: r.title as LocalizedText }]));
	return ids.flatMap((id) => byId.get(id) ?? []);
}
