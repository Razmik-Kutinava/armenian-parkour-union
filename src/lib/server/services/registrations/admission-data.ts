import { and, eq, isNull } from 'drizzle-orm';
import type { LimitDb } from '../../auth/rate-limit';
import { eventCategories, events } from '../../db/schema/events';
import { eventRegistrations } from '../../db/schema/registrations';
import { users } from '../../db/schema/users';
import { hasValidConsent } from '../consents/valid';
import { getMembershipOverview } from '../memberships/overview';
import type { AdmissionInput } from './admission';

/* Reads for `checkAdmission` inside the registration transaction. */

/** Locks the event row first. Drafts, archived and future publications do not exist for members. */
export async function lockShownEvent(tx: LimitDb, eventId: string, now: Date) {
	const [event] = await tx
		.select()
		.from(events)
		.where(and(eq(events.id, eventId), isNull(events.deletedAt)))
		.for('update');
	if (!event || !event.publishedAt || event.publishedAt > now) return null;
	return ['published', 'finished', 'cancelled'].includes(event.status) ? event : null;
}

export async function readMember(tx: LimitDb, userId: string) {
	const [user] = await tx
		.select({
			status: users.status,
			emailVerified: users.emailVerified,
			birthDate: users.birthDate,
			deletedAt: users.deletedAt
		})
		.from(users)
		.where(eq(users.id, userId));
	return user && !user.deletedAt ? user : null;
}

/** The member's row for the event (locked), membership, consent and the event categories. */
export async function readAdmission(tx: LimitDb, eventId: string, userId: string, now: Date) {
	const [existing] = await tx
		.select({ id: eventRegistrations.id, status: eventRegistrations.status })
		.from(eventRegistrations)
		.where(and(eq(eventRegistrations.eventId, eventId), eq(eventRegistrations.userId, userId)))
		.for('update');
	const [membership, parentalConsent, categories] = await Promise.all([
		getMembershipOverview(tx, userId, now),
		hasValidConsent(tx, userId, 'parental', now),
		tx
			.select({
				id: eventCategories.id,
				ageMin: eventCategories.ageMin,
				ageMax: eventCategories.ageMax
			})
			.from(eventCategories)
			.where(eq(eventCategories.eventId, eventId))
	]);
	const facts: Pick<
		AdmissionInput,
		'membershipActive' | 'parentalConsent' | 'categories' | 'existing'
	> = {
		membershipActive: membership.active,
		parentalConsent,
		categories,
		existing: existing?.status ?? null
	};
	return { existingId: existing?.id ?? null, facts };
}
