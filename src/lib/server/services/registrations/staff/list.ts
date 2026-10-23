import { and, asc, count, desc, eq, ilike, isNull, ne, or, type SQL } from 'drizzle-orm';
import {
	PAGE_SIZE,
	pageOffset,
	type ListOptions,
	type ListState
} from '#lib/components/admin/list-state.ts';
import type { LocalizedText } from '#lib/i18n/localized.ts';
import { ageOn } from '#lib/validation/auth.ts';
import { roleCan } from '../../../auth/permissions';
import type { LimitDb } from '../../../auth/rate-limit';
import { registrationStatus } from '../../../db/schema/enums';
import { eventCategories, events } from '../../../db/schema/events';
import { payments } from '../../../db/schema/payments';
import { eventRegistrations } from '../../../db/schema/registrations';
import { users } from '../../../db/schema/users';
import { isUuid, type Actor } from '../../users/target';
import { YEREVAN_OFFSET, type RegistrationStatus } from '../admission';

/* docs/05 section 5, docs/04 section 4: one event's registrations for staff. A moderator gets the
 * name and the age; the email — only with `users.read_full`, the payment id — with `payments.read`. */

export const registrationListOptions: ListOptions = {
	sortable: ['registeredAt'],
	filters: ['status', 'category', 'paid'],
	defaultSort: { key: 'registeredAt', dir: 'asc' }
};

export type StaffRegistrationRow = {
	id: string;
	userId: string;
	name: string;
	email?: string;
	/** On the event day in Yerevan; the birth date itself never leaves the server. */
	age: number | null;
	categoryId: string | null;
	categoryName: LocalizedText | null;
	status: RegistrationStatus;
	/** `null` — a free event. */
	paid: boolean | null;
	paymentId?: string | null;
	registeredAt: Date;
	holdUntil: Date | null;
	attendedAt: Date | null;
	place: number | null;
	score: string | null;
	resultNote: string | null;
};

const escapeLike = (s: string) => s.replace(/[\\%_]/g, (c) => `\\${c}`);

function conditions(eventId: string, state: ListState, contacts: boolean): SQL | undefined {
	const f = state.filters;
	const where: (SQL | undefined)[] = [eq(eventRegistrations.eventId, eventId)];
	const status = registrationStatus.enumValues.find((s) => s === f.status);
	if (status) where.push(eq(eventRegistrations.status, status));
	if (f.category && isUuid(f.category)) where.push(eq(eventRegistrations.categoryId, f.category));
	if (f.paid === '1') where.push(eq(payments.status, 'paid'));
	if (f.paid === '0') where.push(or(isNull(payments.id), ne(payments.status, 'paid')));
	if (state.q) {
		const like = `%${escapeLike(state.q)}%`;
		where.push(or(ilike(users.name, like), contacts ? ilike(users.email, like) : undefined));
	}
	return and(...where);
}

function query(db: LimitDb, viewer: Actor, eventId: string, state: ListState) {
	const contacts = roleCan(viewer.role, 'users.read_full');
	const money = roleCan(viewer.role, 'payments.read');
	const order = state.dir === 'desc' ? desc : asc;
	return db
		.select({
			id: eventRegistrations.id,
			userId: eventRegistrations.userId,
			name: users.name,
			birthDate: users.birthDate,
			...(contacts ? { email: users.email } : {}),
			categoryId: eventRegistrations.categoryId,
			categoryName: eventCategories.name,
			status: eventRegistrations.status,
			paymentStatus: payments.status,
			...(money ? { paymentId: eventRegistrations.paymentId } : {}),
			registeredAt: eventRegistrations.registeredAt,
			holdUntil: eventRegistrations.holdUntil,
			attendedAt: eventRegistrations.attendedAt,
			place: eventRegistrations.place,
			score: eventRegistrations.score,
			resultNote: eventRegistrations.resultNote
		})
		.from(eventRegistrations)
		.innerJoin(users, eq(users.id, eventRegistrations.userId))
		.leftJoin(eventCategories, eq(eventCategories.id, eventRegistrations.categoryId))
		.leftJoin(payments, eq(payments.id, eventRegistrations.paymentId))
		.where(conditions(eventId, state, contacts))
		.orderBy(order(eventRegistrations.registeredAt), asc(eventRegistrations.id))
		.$dynamic();
}

type Raw = Awaited<ReturnType<typeof query>>[number] & {
	email?: string;
	paymentId?: string | null;
};
type EventFacts = { startsAt: Date; priceAmountMinor: number };

function shown({ birthDate, paymentStatus, ...row }: Raw, event: EventFacts) {
	const day = new Date(event.startsAt.getTime() + YEREVAN_OFFSET);
	return {
		...row,
		categoryName: row.categoryName as LocalizedText | null,
		age: birthDate ? ageOn(birthDate, day) : null,
		paid: event.priceAmountMinor > 0 ? paymentStatus === 'paid' : null
	} satisfies StaffRegistrationRow;
}

async function eventFacts(db: LimitDb, eventId: string): Promise<EventFacts | null> {
	if (!isUuid(eventId)) return null;
	const [event] = await db
		.select({ startsAt: events.startsAt, priceAmountMinor: events.priceAmountMinor })
		.from(events)
		.where(and(eq(events.id, eventId), isNull(events.deletedAt)));
	return event ?? null;
}

/** `null` — no such event. */
export async function listRegistrations(
	db: LimitDb,
	viewer: Actor,
	eventId: string,
	state: ListState
): Promise<{ rows: StaffRegistrationRow[]; total: number } | null> {
	const event = await eventFacts(db, eventId);
	if (!event) return null;
	const rows = await query(db, viewer, eventId, state)
		.limit(PAGE_SIZE)
		.offset(pageOffset(state.page));
	const [{ total }] = await db
		.select({ total: count() })
		.from(eventRegistrations)
		.innerJoin(users, eq(users.id, eventRegistrations.userId))
		.leftJoin(payments, eq(payments.id, eventRegistrations.paymentId))
		.where(conditions(eventId, state, roleCan(viewer.role, 'users.read_full')));
	return { rows: rows.map((r) => shown(r, event)), total };
}

/** Same filters and order as the list, capped so a click cannot hang the server. */
export async function registrationsForExport(
	db: LimitDb,
	viewer: Actor,
	eventId: string,
	state: ListState,
	max = 10_000
): Promise<StaffRegistrationRow[]> {
	const event = await eventFacts(db, eventId);
	if (!event) return [];
	const rows = await query(db, viewer, eventId, state).limit(max);
	return rows.map((r) => shown(r, event));
}

export { registrationCounts, type RegistrationCounts } from './counts';
