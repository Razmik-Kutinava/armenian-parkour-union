import { and, count, eq, inArray } from 'drizzle-orm';
import type { LimitDb } from '../../auth/rate-limit';
import { eventCategories } from '../../db/schema/events';
import { eventRegistrations } from '../../db/schema/registrations';
import type { RegistrationStatus } from './admission';

/* docs/02 section 3: an unpaid registration holds its seat too (decisions.md 2026-10-22, 5.1).
 * Read under the event row lock, so the numbers do not move until the commit. */

export const SEAT_STATUSES: RegistrationStatus[] = [
	'registered',
	'pending_payment',
	'attended',
	'no_show'
];

export const holdsSeat = (status: RegistrationStatus) => SEAT_STATUSES.includes(status);

export type Seats = {
	eventCapacity: number | null;
	eventTaken: number;
	/** Category id → its limit (`null` — none) and seats taken in it. */
	categories: Map<string, { capacity: number | null; taken: number }>;
};

export async function readSeats(
	tx: LimitDb,
	eventId: string,
	eventCapacity: number | null
): Promise<Seats> {
	const [categoryRows, taken] = await Promise.all([
		tx
			.select({ id: eventCategories.id, capacity: eventCategories.capacity })
			.from(eventCategories)
			.where(eq(eventCategories.eventId, eventId)),
		tx
			.select({ categoryId: eventRegistrations.categoryId, n: count() })
			.from(eventRegistrations)
			.where(
				and(
					eq(eventRegistrations.eventId, eventId),
					inArray(eventRegistrations.status, SEAT_STATUSES)
				)
			)
			.groupBy(eventRegistrations.categoryId)
	]);
	const categories = new Map(categoryRows.map((c) => [c.id, { capacity: c.capacity, taken: 0 }]));
	let eventTaken = 0;
	for (const row of taken) {
		eventTaken += row.n;
		const category = row.categoryId ? categories.get(row.categoryId) : undefined;
		if (category) category.taken += row.n;
	}
	return { eventCapacity, eventTaken, categories };
}

const full = (capacity: number | null, taken: number) => capacity !== null && taken >= capacity;

export function hasSeat(seats: Seats, categoryId: string | null): boolean {
	if (full(seats.eventCapacity, seats.eventTaken)) return false;
	const category = categoryId ? seats.categories.get(categoryId) : undefined;
	return !category || !full(category.capacity, category.taken);
}

export function takeSeat(seats: Seats, categoryId: string | null) {
	seats.eventTaken += 1;
	const category = categoryId ? seats.categories.get(categoryId) : undefined;
	if (category) category.taken += 1;
}
