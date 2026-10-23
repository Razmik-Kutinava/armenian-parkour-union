import { and, eq } from 'drizzle-orm';
import type { LimitDb } from '../../../auth/rate-limit';
import { eventRegistrations } from '../../../db/schema/registrations';
import { users } from '../../../db/schema/users';
import { lockEvent } from '../../events/checks';
import { isUuid } from '../../users/target';

export type RegistrationRef = { eventId: string; registrationId: string };

/** The event row first, like every registration change, then the registration of that event. */
export async function lockRegistration(tx: LimitDb, ref: RegistrationRef) {
	if (!isUuid(ref.eventId) || !isUuid(ref.registrationId)) return null;
	const event = await lockEvent(tx, ref.eventId);
	if (!event) return null;
	const [row] = await tx
		.select({
			id: eventRegistrations.id,
			userId: eventRegistrations.userId,
			categoryId: eventRegistrations.categoryId,
			status: eventRegistrations.status,
			paymentId: eventRegistrations.paymentId,
			place: eventRegistrations.place,
			user: {
				email: users.email,
				locale: users.locale,
				firstName: users.firstName,
				name: users.name
			}
		})
		.from(eventRegistrations)
		.innerJoin(users, eq(users.id, eventRegistrations.userId))
		.where(
			and(eq(eventRegistrations.id, ref.registrationId), eq(eventRegistrations.eventId, event.id))
		)
		.for('update', { of: eventRegistrations });
	return row ? { event, row } : null;
}
