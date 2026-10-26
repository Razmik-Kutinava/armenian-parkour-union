import { and, eq, isNull, sql } from 'drizzle-orm';
import { roleCan } from '../../../auth/permissions';
import type { LimitDb } from '../../../auth/rate-limit';
import { eventRegistrations } from '../../../db/schema/registrations';
import { users } from '../../../db/schema/users';
import { writeAudit } from '../../audit';
import { lockEvent } from '../../events/checks';
import { isUuid, type Actor } from '../../users/target';
import { checkStaffAdmission, type Refusal } from '../admission';
import { readAdmission } from '../admission-data';
import { registeredLetter, type LetterDeps } from '../mail';
import { RECIPIENT } from '../recipient';
import { CLEARED } from '../register';
import { hasSeat, readSeats } from '../seats';
import { sendLetters } from '../waitlist';

/* docs/05 section 5: staff add a member by hand — on a published event, past the registration
 * window and the start ("event day"); the member conditions of docs/03 section 7.2 still hold.
 * No payment and no registration points (section 6.2 p. 5: only a registration made on the site).
 * The member gets the "you are registered" letter after the commit (owner's answer 2026-10-26). */

export type AddInput = { eventId: string; member: string; categoryId: string | null };
export type AddRefusal =
	Refusal | 'not_found' | 'not_allowed' | 'user_not_found' | 'event_closed' | 'full';
export type AddResult = { ok: true; id: string } | { ok: false; reason: AddRefusal };

const refuse = (reason: AddRefusal) => ({ ok: false, reason }) as const;

/** By id or email (any case); deleted accounts are not found. */
async function findMember(tx: LimitDb, member: string) {
	const key = member.trim();
	const [user] = await tx
		.select({
			id: users.id,
			status: users.status,
			emailVerified: users.emailVerified,
			birthDate: users.birthDate,
			...RECIPIENT
		})
		.from(users)
		.where(
			and(
				isUuid(key) ? eq(users.id, key) : sql`lower(${users.email}) = ${key.toLowerCase()}`,
				isNull(users.deletedAt)
			)
		);
	return user ?? null;
}

export async function addRegistration(
	db: LimitDb,
	actor: Actor,
	input: AddInput,
	ip: string | null,
	mail: LetterDeps | null = null,
	now = new Date()
): Promise<AddResult> {
	if (!roleCan(actor.role, 'registrations.manage')) return refuse('not_allowed');
	if (!isUuid(input.eventId)) return refuse('not_found');
	if (input.categoryId !== null && !isUuid(input.categoryId)) return refuse('category_invalid');
	const outcome = await db.transaction(async (tx) => {
		const event = await lockEvent(tx, input.eventId);
		if (!event) return refuse('not_found');
		if (event.status !== 'published') return refuse('event_closed');
		const user = await findMember(tx, input.member);
		if (!user) return refuse('user_not_found');
		const { existingId, facts } = await readAdmission(tx, event.id, user.id, now);
		const { categoryId } = input;
		const refusal = checkStaffAdmission({ now, event, user, categoryId, ...facts });
		if (refusal) return refuse(refusal);
		if (!hasSeat(await readSeats(tx, event.id, event.capacity), categoryId)) return refuse('full');

		const values = {
			categoryId,
			status: 'registered' as const,
			holdUntil: null,
			registeredAt: sql`clock_timestamp()`
		};
		const [row] = existingId
			? await tx
					.update(eventRegistrations)
					.set({ ...values, ...CLEARED })
					.where(eq(eventRegistrations.id, existingId))
					.returning({ id: eventRegistrations.id })
			: await tx
					.insert(eventRegistrations)
					.values({ eventId: event.id, userId: user.id, ...values })
					.returning({ id: eventRegistrations.id });
		await writeAudit(tx, {
			actorId: actor.id,
			action: 'registration.add',
			entityType: 'registration',
			entityId: row.id,
			after: { eventId: event.id, userId: user.id, categoryId, status: 'registered' },
			ip
		});
		return { ok: true as const, id: row.id, to: user, event };
	});
	if (!outcome.ok) return outcome;
	if (mail) {
		const letter = registeredLetter(outcome.to, outcome.event, 'registered', mail.siteUrl);
		await sendLetters(mail.send, [letter]);
	}
	return { ok: true, id: outcome.id };
}
