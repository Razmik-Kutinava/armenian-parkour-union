import { asc, count, desc, eq, sql, type SQL } from 'drizzle-orm';
import {
	pageOffset,
	PAGE_SIZE,
	type ListOptions,
	type ListState
} from '#lib/components/admin/list-state.ts';
import type { LocalizedText } from '#lib/i18n/localized.ts';
import type { LimitDb } from '../../auth/rate-limit';
import { events } from '../../db/schema/events';
import { users } from '../../db/schema/users';
import { volunteerInvitations, volunteerRequests } from '../../db/schema/volunteer-requests';
import { isUuid } from '../users/target';

/* docs/05 section 28 "Requests": list and card. */

export const requestStatuses = ['draft', 'open', 'finished', 'cancelled'] as const;
export const requestListOptions: ListOptions = {
	sortable: [],
	filters: ['status'],
	defaultSort: { key: 'startsAt', dir: 'desc' }
};

export type RequestFilter = {
	status: (typeof requestStatuses)[number] | 'all';
	page: number;
};

export const requestFilter = (state: ListState): RequestFilter => ({
	status:
		state.filters.status === 'all'
			? 'all'
			: (requestStatuses.find((s) => s === state.filters.status) ?? 'all'),
	page: state.page
});

export async function listRequests(db: LimitDb, filter: RequestFilter) {
	const where: SQL | undefined =
		filter.status === 'all' ? undefined : eq(volunteerRequests.status, filter.status);
	const [rows, [{ total }]] = await Promise.all([
		db
			.select({
				id: volunteerRequests.id,
				title: volunteerRequests.title,
				startsAt: volunteerRequests.startsAt,
				respondBy: volunteerRequests.respondBy,
				places: volunteerRequests.places,
				status: volunteerRequests.status,
				eventTitle: events.title,
				accepted: sql<number>`(select count(*)::int from volunteer_invitations a
					where a.request_id = ${volunteerRequests.id} and a.status = 'accepted')`
			})
			.from(volunteerRequests)
			.leftJoin(events, eq(events.id, volunteerRequests.eventId))
			.where(where)
			.orderBy(desc(volunteerRequests.startsAt), asc(volunteerRequests.id))
			.limit(PAGE_SIZE)
			.offset(pageOffset(filter.page)),
		db.select({ total: count() }).from(volunteerRequests).where(where)
	]);
	return {
		rows: rows.map((r) => ({
			...r,
			title: r.title as LocalizedText,
			eventTitle: (r.eventTitle as LocalizedText | null) ?? null
		})),
		total
	};
}

export async function getRequest(db: LimitDb, id: string) {
	if (!isUuid(id)) return null;
	const [row] = await db
		.select({
			id: volunteerRequests.id,
			title: volunteerRequests.title,
			description: volunteerRequests.description,
			eventId: volunteerRequests.eventId,
			eventTitle: events.title,
			startsAt: volunteerRequests.startsAt,
			endsAt: volunteerRequests.endsAt,
			location: volunteerRequests.location,
			places: volunteerRequests.places,
			respondBy: volunteerRequests.respondBy,
			status: volunteerRequests.status,
			publishedAt: volunteerRequests.publishedAt,
			accepted: sql<number>`(select count(*)::int from volunteer_invitations a
				where a.request_id = ${volunteerRequests.id} and a.status = 'accepted')`
		})
		.from(volunteerRequests)
		.leftJoin(events, eq(events.id, volunteerRequests.eventId))
		.where(eq(volunteerRequests.id, id));
	if (!row) return null;
	const invites = await db
		.select({
			id: volunteerInvitations.id,
			status: volunteerInvitations.status,
			answeredAt: volunteerInvitations.answeredAt,
			userId: users.id,
			name: users.name,
			email: users.email
		})
		.from(volunteerInvitations)
		.innerJoin(users, eq(users.id, volunteerInvitations.userId))
		.where(eq(volunteerInvitations.requestId, id))
		.orderBy(asc(users.name), asc(volunteerInvitations.id));
	return {
		...row,
		title: row.title as LocalizedText,
		description: row.description as LocalizedText | null,
		eventTitle: (row.eventTitle as LocalizedText | null) ?? null,
		invites
	};
}
export type RequestDetail = NonNullable<Awaited<ReturnType<typeof getRequest>>>;
