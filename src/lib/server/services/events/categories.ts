import { isDeepStrictEqual } from 'node:util';
import { and, asc, eq, isNull } from 'drizzle-orm';
import type { LocalizedText } from '#lib/i18n/localized.ts';
import type { Discipline, EventCategoryValues } from '#lib/validation/events.ts';
import { roleCan } from '../../auth/permissions';
import type { LimitDb } from '../../auth/rate-limit';
import { eventCategories, events } from '../../db/schema/events';
import { writeAudit } from '../audit';
import { isUuid, type Actor } from '../users/target';

/* docs/05 section 5, tab "Categories". Delete is refused with registrations — from stage 5. */

type Missing = 'not_allowed' | 'not_found';
export type EventCategory = {
	id: string;
	name: LocalizedText;
	discipline: Discipline;
	ageMin: number | null;
	ageMax: number | null;
	capacity: number | null;
	sortOrder: number;
};
const FIELDS = ['name', 'discipline', 'ageMin', 'ageMax', 'capacity', 'sortOrder'] as const;

export async function listEventCategories(db: LimitDb, eventId: string): Promise<EventCategory[]> {
	if (!isUuid(eventId)) return [];
	const rows = await db
		.select({
			id: eventCategories.id,
			name: eventCategories.name,
			discipline: eventCategories.discipline,
			ageMin: eventCategories.ageMin,
			ageMax: eventCategories.ageMax,
			capacity: eventCategories.capacity,
			sortOrder: eventCategories.sortOrder
		})
		.from(eventCategories)
		.where(eq(eventCategories.eventId, eventId))
		.orderBy(asc(eventCategories.sortOrder), asc(eventCategories.createdAt));
	return rows as EventCategory[];
}

/** The event row is locked FOR SHARE: a category is not added to an event being deleted. */
async function eventAlive(tx: LimitDb, eventId: string) {
	const [row] = await tx
		.select({ id: events.id })
		.from(events)
		.where(and(eq(events.id, eventId), isNull(events.deletedAt)))
		.for('share');
	return !!row;
}

async function lockCategory(tx: LimitDb, eventId: string, id: string) {
	if (!isUuid(id) || !(await eventAlive(tx, eventId))) return undefined;
	const [row] = await tx
		.select()
		.from(eventCategories)
		.where(and(eq(eventCategories.id, id), eq(eventCategories.eventId, eventId)))
		.for('update');
	return row;
}

export async function createEventCategory(
	db: LimitDb,
	actor: Actor,
	eventId: string,
	values: EventCategoryValues,
	ip: string | null
): Promise<{ id: string } | Missing> {
	if (!roleCan(actor.role, 'events.write')) return 'not_allowed';
	if (!isUuid(eventId)) return 'not_found';
	return db.transaction(async (tx) => {
		if (!(await eventAlive(tx, eventId))) return 'not_found' as const;
		const [row] = await tx
			.insert(eventCategories)
			.values({ ...values, eventId })
			.returning({ id: eventCategories.id });
		await writeAudit(tx, {
			actorId: actor.id,
			action: 'event_category.create',
			entityType: 'event_category',
			entityId: row.id,
			after: { eventId, ...values },
			ip
		});
		return { id: row.id };
	});
}

export async function updateEventCategory(
	db: LimitDb,
	actor: Actor,
	eventId: string,
	id: string,
	values: EventCategoryValues,
	ip: string | null
): Promise<'ok' | Missing> {
	if (!roleCan(actor.role, 'events.write')) return 'not_allowed';
	if (!isUuid(eventId)) return 'not_found';
	return db.transaction(async (tx) => {
		const category = await lockCategory(tx, eventId, id);
		if (!category) return 'not_found' as const;
		const before: Record<string, unknown> = {};
		const after: Record<string, unknown> = {};
		for (const key of FIELDS) {
			if (isDeepStrictEqual(category[key], values[key])) continue;
			before[key] = category[key];
			after[key] = values[key];
		}
		if (Object.keys(after).length === 0) return 'ok' as const;
		await tx.update(eventCategories).set(values).where(eq(eventCategories.id, category.id));
		await writeAudit(tx, {
			actorId: actor.id,
			action: 'event_category.update',
			entityType: 'event_category',
			entityId: category.id,
			before: { eventId, ...before },
			after: { eventId, ...after },
			ip
		});
		return 'ok' as const;
	});
}

export async function deleteEventCategory(
	db: LimitDb,
	actor: Actor,
	eventId: string,
	id: string,
	ip: string | null
): Promise<'ok' | Missing> {
	if (!roleCan(actor.role, 'events.write')) return 'not_allowed';
	if (!isUuid(eventId)) return 'not_found';
	return db.transaction(async (tx) => {
		const category = await lockCategory(tx, eventId, id);
		if (!category) return 'not_found' as const;
		await tx.delete(eventCategories).where(eq(eventCategories.id, category.id));
		await writeAudit(tx, {
			actorId: actor.id,
			action: 'event_category.delete',
			entityType: 'event_category',
			entityId: category.id,
			before: { eventId, name: category.name, discipline: category.discipline },
			ip
		});
		return 'ok' as const;
	});
}
