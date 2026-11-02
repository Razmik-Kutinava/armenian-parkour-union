import { and, desc, eq, isNull, sql } from 'drizzle-orm';
import type { LocalizedText } from '#lib/i18n/localized.ts';
import type { LimitDb } from '../../auth/rate-limit';
import { events } from '../../db/schema/events';
import { users } from '../../db/schema/users';
import { volunteerCards } from '../../db/schema/volunteer-cards';
import { volunteerInvitations, volunteerRequests } from '../../db/schema/volunteer-requests';
import { isUuid } from '../users/target';
import { cardFacts } from './card-facts';
import { cardValidity } from './card-rules';

/* docs/06 section 5.12 "Invitations": open while the request is open and respond_by has not
 * passed; past — the rest. Buttons follow docs/03 section 19.5 p. 3. */

export type OwnInvite = {
	id: string;
	requestId: string;
	title: LocalizedText;
	startsAt: Date;
	endsAt: Date;
	location: string | null;
	eventTitle: LocalizedText | null;
	respondBy: Date;
	status: (typeof volunteerInvitations.$inferSelect)['status'];
	placesLeft: number;
	canAccept: boolean;
	canDecline: boolean;
};

export type OwnInvites = { open: OwnInvite[]; past: OwnInvite[] };

export async function listOwnInvites(
	db: LimitDb,
	userId: string,
	now = new Date()
): Promise<OwnInvites> {
	if (!isUuid(userId)) return { open: [], past: [] };
	const rows = await db
		.select({
			id: volunteerInvitations.id,
			requestId: volunteerRequests.id,
			title: volunteerRequests.title,
			startsAt: volunteerRequests.startsAt,
			endsAt: volunteerRequests.endsAt,
			location: volunteerRequests.location,
			respondBy: volunteerRequests.respondBy,
			requestStatus: volunteerRequests.status,
			places: volunteerRequests.places,
			status: volunteerInvitations.status,
			eventTitle: events.title,
			accepted: sql<number>`(select count(*)::int from volunteer_invitations a
				where a.request_id = ${volunteerRequests.id} and a.status = 'accepted')`
		})
		.from(volunteerInvitations)
		.innerJoin(volunteerRequests, eq(volunteerRequests.id, volunteerInvitations.requestId))
		.leftJoin(events, eq(events.id, volunteerRequests.eventId))
		.where(eq(volunteerInvitations.userId, userId))
		.orderBy(desc(volunteerRequests.startsAt), desc(volunteerInvitations.id));

	const [member] = await db
		.select({
			status: users.status,
			birthDate: users.birthDate,
			emailVerified: users.emailVerified,
			avatarKey: users.avatarKey
		})
		.from(users)
		.where(and(eq(users.id, userId), isNull(users.deletedAt)));
	let cardValid = false;
	if (member) {
		const [card] = await db
			.select({ status: volunteerCards.status })
			.from(volunteerCards)
			.where(eq(volunteerCards.userId, userId));
		if (card) {
			const facts = await cardFacts(db, userId, member, now);
			cardValid = cardValidity(card.status, facts, now).valid;
		}
	}

	const open: OwnInvite[] = [];
	const past: OwnInvite[] = [];
	for (const r of rows) {
		const placesLeft = Math.max(0, r.places - r.accepted);
		const windowOpen = r.requestStatus === 'open' && r.respondBy > now;
		const answerable =
			windowOpen && cardValid && ['invited', 'accepted', 'declined'].includes(r.status);
		const item: OwnInvite = {
			id: r.id,
			requestId: r.requestId,
			title: r.title as LocalizedText,
			startsAt: r.startsAt,
			endsAt: r.endsAt,
			location: r.location,
			eventTitle: (r.eventTitle as LocalizedText | null) ?? null,
			respondBy: r.respondBy,
			status: r.status,
			placesLeft,
			canAccept: Boolean(answerable && r.status !== 'accepted' && placesLeft > 0),
			canDecline: Boolean(answerable && r.status !== 'declined')
		};
		(windowOpen ? open : past).push(item);
	}
	return { open, past };
}
