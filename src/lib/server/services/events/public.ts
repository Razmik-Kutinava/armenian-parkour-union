import {
	and,
	asc,
	count,
	desc,
	eq,
	exists,
	gte,
	inArray,
	isNull,
	lte,
	sql,
	type SQL
} from 'drizzle-orm';
import { pickLocalized, type LocalizedText } from '#lib/i18n/localized.ts';
import type { Locale } from '#lib/i18n/locales.ts';
import type { Discipline, EventStatus } from '#lib/validation/events.ts';
import type { PostText } from '#lib/validation/posts.ts';
import type { LimitDb } from '../../auth/rate-limit';
import { eventCategories, events } from '../../db/schema/events';
import { media } from '../../db/schema/service';
import { isUuid } from '../users/target';
import { listEventCategories } from './categories';
import { registrationWindow, type RegistrationWindow } from './window';

/* docs/06 sections 4.2–4.3; docs/03 section 7.1, 7.9; 2.5 defaults 1, 4, 5 (decisions.md). */

export const EVENTS_PAGE_SIZE = 12;
export type EventPeriod = 'week' | 'month' | '3months';
const PERIODS: Record<EventPeriod, string> = {
	week: '7 days',
	month: '1 month',
	'3months': '3 months'
};

export type EventCard = {
	slug: string;
	title: string;
	coverKey: string | null;
	coverAlt: string;
	city: string | null;
	startsAt: Date;
	endsAt: Date;
	priceAmountMinor: number;
	priceCurrency: string;
	window: RegistrationWindow;
};
export type PublicEvent = EventCard & {
	id: string;
	html: string;
	status: EventStatus;
	locationName: string | null;
	address: string | null;
	latitude: number | null;
	longitude: number | null;
	capacity: number | null;
	updatedAt: Date;
	categories: {
		name: string;
		discipline: Discipline;
		ageMin: number | null;
		ageMax: number | null;
		capacity: number | null;
	}[];
};

const live = and(lte(events.publishedAt, sql`now()`), isNull(events.deletedAt));
/** A cancelled or finished event still opens by its link; drafts and archived ones do not. */
const openable = and(live, inArray(events.status, ['published', 'finished', 'cancelled']));
/** Listed until it ends: a running multi-day event is still shown. */
const listed = and(live, eq(events.status, 'published'), gte(events.endsAt, sql`now()`));
const finished = and(live, eq(events.status, 'finished'));

const cardColumns = {
	slug: events.slug,
	title: events.title,
	coverKey: events.coverKey,
	coverAlt: media.alt,
	city: events.city,
	startsAt: events.startsAt,
	endsAt: events.endsAt,
	priceAmountMinor: events.priceAmountMinor,
	priceCurrency: events.priceCurrency,
	registrationOpensAt: events.registrationOpensAt,
	registrationClosesAt: events.registrationClosesAt
};
const coverJoin = and(eq(media.key, events.coverKey), isNull(media.deletedAt));
type CardRow = { [K in keyof typeof cardColumns]: unknown };

const pick = (text: unknown, locale: Locale) => {
	const t = (text ?? {}) as PostText;
	return t[locale] || t.en || '';
};
function toCard(row: CardRow, locale: Locale): EventCard {
	const r = row as typeof row & { startsAt: Date; endsAt: Date };
	return {
		slug: r.slug as string,
		title: pickLocalized(r.title as LocalizedText, locale),
		coverKey: r.coverKey as string | null,
		coverAlt: pick(r.coverAlt, locale),
		city: r.city as string | null,
		startsAt: r.startsAt,
		endsAt: r.endsAt,
		priceAmountMinor: r.priceAmountMinor as number,
		priceCurrency: r.priceCurrency as string,
		window: registrationWindow({
			startsAt: r.startsAt,
			registrationOpensAt: r.registrationOpensAt as Date | null,
			registrationClosesAt: r.registrationClosesAt as Date | null
		})
	};
}

async function page(db: LimitDb, where: SQL | undefined, order: SQL[], n: number, locale: Locale) {
	const rows = await db
		.select(cardColumns)
		.from(events)
		.leftJoin(media, coverJoin)
		.where(where)
		.orderBy(...order, asc(events.id))
		.limit(EVENTS_PAGE_SIZE)
		.offset((n - 1) * EVENTS_PAGE_SIZE);
	const [{ total }] = await db.select({ total: count() }).from(events).where(where);
	return { rows: rows.map((r) => toCard(r, locale)), total };
}

export type UpcomingQuery = {
	locale: Locale;
	page: number;
	city?: string;
	period?: EventPeriod;
	price?: 'free' | 'paid';
	discipline?: Discipline;
};

export function listUpcomingEvents(db: LimitDb, q: UpcomingQuery) {
	const where: (SQL | undefined)[] = [listed];
	if (q.city) where.push(eq(events.city, q.city));
	if (q.period && PERIODS[q.period]) {
		where.push(sql`${events.startsAt} < now() + ${PERIODS[q.period]}::interval`);
	}
	if (q.price === 'free') where.push(eq(events.priceAmountMinor, 0));
	if (q.price === 'paid') where.push(sql`${events.priceAmountMinor} > 0`);
	if (q.discipline) {
		const inCategory = db
			.select({ one: sql`1` })
			.from(eventCategories)
			.where(
				and(eq(eventCategories.eventId, events.id), eq(eventCategories.discipline, q.discipline))
			);
		where.push(exists(inCategory));
	}
	return page(db, and(...where), [asc(events.startsAt)], q.page, q.locale);
}

export async function listUpcomingCities(db: LimitDb): Promise<string[]> {
	const rows = await db
		.selectDistinct({ city: events.city })
		.from(events)
		.where(and(listed, sql`${events.city} is not null`))
		.orderBy(asc(events.city))
		.limit(200);
	return rows.map((r) => r.city as string);
}

export const listArchivedEvents = (db: LimitDb, q: { locale: Locale; page: number }) =>
	page(db, finished, [desc(events.startsAt)], q.page, q.locale);

async function oneEvent(db: LimitDb, where: SQL | undefined, locale: Locale) {
	const [row] = await db
		.select({
			...cardColumns,
			id: events.id,
			description: events.description,
			status: events.status,
			locationName: events.locationName,
			address: events.address,
			latitude: events.latitude,
			longitude: events.longitude,
			capacity: events.capacity,
			updatedAt: events.updatedAt
		})
		.from(events)
		.leftJoin(media, coverJoin)
		.where(where);
	if (!row) return null;
	const categories = await listEventCategories(db, row.id);
	const { description, ...rest } = row;
	return {
		...rest,
		...toCard(row, locale),
		html: pick(description, locale),
		categories: categories.map((c) => ({
			name: pickLocalized(c.name, locale),
			discipline: c.discipline,
			ageMin: c.ageMin,
			ageMax: c.ageMax,
			capacity: c.capacity
		}))
	} satisfies PublicEvent;
}

export const getPublicEvent = (db: LimitDb, slug: string, locale: Locale) =>
	oneEvent(db, and(openable, eq(events.slug, slug)), locale);

/** Admin preview (events.write is checked by the route): the saved event in any status. */
export const getEventPreview = async (db: LimitDb, id: string, locale: Locale) =>
	isUuid(id) ? oneEvent(db, and(eq(events.id, id), isNull(events.deletedAt)), locale) : null;
