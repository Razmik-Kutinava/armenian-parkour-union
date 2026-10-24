import { and, desc, eq, inArray, isNull, sql } from 'drizzle-orm';
import type { Locale } from '#lib/i18n/locales.ts';
import { pickLocalized, type LocalizedText } from '#lib/i18n/localized.ts';
import type { LimitDb } from '../../auth/rate-limit';
import { eventCategories, events } from '../../db/schema/events';
import { pointsLedger } from '../../db/schema/points';
import { eventRegistrations } from '../../db/schema/registrations';
import { users } from '../../db/schema/users';
import type { RegistrationStatus } from '../registrations/admission';
import { CANCELLABLE, cancelDeadline } from '../registrations/cancel';
import type { RegistrationSettings } from '../registrations/settings';
import { isUuid } from '../users/target';

/* docs/06 section 5.4: the member's own registrations; the user id comes from the session (docs/04
 * section 5.3). Buttons are hints only: pay and cancel check everything again (registrations/). */

export type OwnEvent = {
	eventId: string;
	slug: string;
	title: string;
	startsAt: Date;
	endsAt: Date;
	/** The event page is on the site: published, finished or cancelled. */
	linked: boolean;
	eventCancelled: boolean;
	categoryName: string | null;
	status: RegistrationStatus;
	/** `pending_payment`: the seat is held until then. */
	holdUntil: Date | null;
	place: number | null;
	score: string | null;
	/** What the points ledger holds for this registration, reversals included. */
	points: number;
	canPay: boolean;
	/** `null` — nothing to cancel or too late. */
	cancelUntil: Date | null;
};

export type OwnEvents = { upcoming: OwnEvent[]; past: OwnEvent[] };

const LIMIT = 200;
const SHOWN = ['published', 'finished', 'cancelled'];
const TOOK_PART: RegistrationStatus[] = ['registered', 'attended', 'no_show'];

async function readRows(db: LimitDb, userId: string) {
	return db
		.select({
			id: eventRegistrations.id,
			status: eventRegistrations.status,
			holdUntil: eventRegistrations.holdUntil,
			place: eventRegistrations.place,
			score: eventRegistrations.score,
			eventId: events.id,
			slug: events.slug,
			title: events.title,
			eventStatus: events.status,
			publishedAt: events.publishedAt,
			startsAt: events.startsAt,
			endsAt: events.endsAt,
			categoryName: eventCategories.name
		})
		.from(eventRegistrations)
		.innerJoin(users, eq(users.id, eventRegistrations.userId))
		.innerJoin(events, eq(events.id, eventRegistrations.eventId))
		.leftJoin(eventCategories, eq(eventCategories.id, eventRegistrations.categoryId))
		.where(
			and(eq(eventRegistrations.userId, userId), isNull(users.deletedAt), isNull(events.deletedAt))
		)
		.orderBy(desc(events.startsAt), desc(events.id))
		.limit(LIMIT);
}

/** Points by registration id: every ledger entry whose source is the registration. */
async function readPoints(db: LimitDb, userId: string, ids: string[]) {
	if (ids.length === 0) return new Map<string, number>();
	const rows = await db
		.select({
			id: pointsLedger.sourceId,
			points: sql<number>`coalesce(sum(${pointsLedger.delta}), 0)::int`
		})
		.from(pointsLedger)
		.where(
			and(
				eq(pointsLedger.userId, userId),
				eq(pointsLedger.sourceType, 'event_registration'),
				inArray(pointsLedger.sourceId, ids)
			)
		)
		.groupBy(pointsLedger.sourceId);
	return new Map(rows.map((r) => [r.id ?? '', r.points]));
}

export async function listOwnEvents(
	db: LimitDb,
	userId: string,
	locale: Locale,
	settings: RegistrationSettings,
	now = new Date()
): Promise<OwnEvents> {
	if (!isUuid(userId)) return { upcoming: [], past: [] };
	const rows = await readRows(db, userId);
	const points = await readPoints(
		db,
		userId,
		rows.map((r) => r.id)
	);
	const own = rows.map((r): OwnEvent => {
		const open = r.eventStatus === 'published';
		const deadline = cancelDeadline(r.startsAt, r.status, settings);
		const held = r.status === 'pending_payment' && !!r.holdUntil && r.holdUntil > now;
		return {
			eventId: r.eventId,
			slug: r.slug,
			title: pickLocalized(r.title as LocalizedText, locale),
			startsAt: r.startsAt,
			endsAt: r.endsAt,
			linked: SHOWN.includes(r.eventStatus) && !!r.publishedAt && r.publishedAt <= now,
			eventCancelled: r.eventStatus === 'cancelled',
			categoryName: r.categoryName ? pickLocalized(r.categoryName as LocalizedText, locale) : null,
			status: r.status,
			holdUntil: r.holdUntil,
			place: r.place,
			score: r.score,
			points: points.get(r.id) ?? 0,
			canPay: open && held && r.startsAt > now,
			cancelUntil: open && CANCELLABLE.includes(r.status) && now < deadline ? deadline : null
		};
	});
	return {
		upcoming: own.filter((r) => r.endsAt > now).reverse(),
		past: own.filter((r) => r.endsAt <= now && TOOK_PART.includes(r.status))
	};
}
