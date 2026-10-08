import { and, asc, count, desc, eq, gte, isNotNull, isNull, lt, sql, type SQL } from 'drizzle-orm';
import {
	PAGE_SIZE,
	pageOffset,
	type ListOptions,
	type ListState
} from '#lib/components/admin/list-state.ts';
import type { LocalizedText } from '#lib/i18n/localized.ts';
import { eventStatuses, type EventStatus } from '#lib/validation/events.ts';
import type { PostText } from '#lib/validation/posts.ts';
import type { LimitDb } from '../../auth/rate-limit';
import { events } from '../../db/schema/events';
import { isUuid } from '../users/target';

export const eventListOptions: ListOptions = {
	sortable: [],
	filters: ['status', 'period', 'city', 'price'],
	defaultSort: { key: 'startsAt', dir: 'desc' }
};

export type EventRow = {
	id: string;
	slug: string;
	title: LocalizedText;
	coverKey: string | null;
	status: EventStatus;
	startsAt: Date;
	endsAt: Date;
	city: string | null;
	locationName: string | null;
	capacity: number | null;
	priceAmountMinor: number;
	priceCurrency: string;
};
export type EventDetail = Omit<EventRow, 'title'> & {
	title: LocalizedText;
	description: PostText;
	address: string | null;
	latitude: number | null;
	longitude: number | null;
	registrationOpensAt: Date | null;
	registrationClosesAt: Date | null;
	publishedAt: Date | null;
	createdBy: string | null;
	updatedAt: Date;
};

const escapeLike = (s: string) => s.replace(/[\\%_]/g, (c) => `\\${c}`);

/** docs/05 section 5: status, upcoming / past (by the end), city, free / paid; search by title. */
function conditions({ q, filters }: ListState): SQL[] {
	const where: SQL[] = [isNull(events.deletedAt)];
	if (q) where.push(sql`${events.title}::text ilike ${`%${escapeLike(q)}%`}`);
	const status = filters.status as EventStatus | undefined;
	if (status && eventStatuses.includes(status)) where.push(eq(events.status, status));
	if (filters.period === 'upcoming') where.push(gte(events.endsAt, sql`now()`));
	if (filters.period === 'past') where.push(lt(events.endsAt, sql`now()`));
	if (filters.city) where.push(eq(events.city, filters.city));
	if (filters.price === 'free') where.push(eq(events.priceAmountMinor, 0));
	if (filters.price === 'paid') where.push(sql`${events.priceAmountMinor} > 0`);
	return where;
}

const rowColumns = {
	id: events.id,
	slug: events.slug,
	title: events.title,
	coverKey: events.coverKey,
	status: events.status,
	startsAt: events.startsAt,
	endsAt: events.endsAt,
	city: events.city,
	locationName: events.locationName,
	capacity: events.capacity,
	priceAmountMinor: events.priceAmountMinor,
	priceCurrency: events.priceCurrency
};

export async function listEvents(
	db: LimitDb,
	state: ListState
): Promise<{ rows: EventRow[]; total: number }> {
	const where = and(...conditions(state));
	const rows = await db
		.select(rowColumns)
		.from(events)
		.where(where)
		.orderBy(desc(events.startsAt), desc(events.id))
		.limit(PAGE_SIZE)
		.offset(pageOffset(state.page));
	const [{ total }] = await db.select({ total: count() }).from(events).where(where);
	return { rows: rows as EventRow[], total };
}

/** Cities for the filter, from events that are not deleted. */
export async function listEventCities(db: LimitDb): Promise<string[]> {
	const rows = await db
		.selectDistinct({ city: events.city })
		.from(events)
		.where(and(isNull(events.deletedAt), isNotNull(events.city)))
		.orderBy(asc(events.city))
		.limit(200);
	return rows.map((r) => r.city as string);
}

export async function getEvent(db: LimitDb, id: string): Promise<EventDetail | null> {
	if (!isUuid(id)) return null;
	const [row] = await db
		.select({
			...rowColumns,
			description: events.description,
			address: events.address,
			latitude: events.latitude,
			longitude: events.longitude,
			registrationOpensAt: events.registrationOpensAt,
			registrationClosesAt: events.registrationClosesAt,
			publishedAt: events.publishedAt,
			createdBy: events.createdBy,
			updatedAt: events.updatedAt
		})
		.from(events)
		.where(and(eq(events.id, id), isNull(events.deletedAt)));
	return (row as EventDetail | undefined) ?? null;
}
