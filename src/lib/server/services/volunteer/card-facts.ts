import { and, eq, isNull, sql } from 'drizzle-orm';
import type { LimitDb } from '../../auth/rate-limit';
import { users } from '../../db/schema/users';
import { volunteerCards } from '../../db/schema/volunteer-cards';
import { certificateYear } from '../certificates/number';
import { hasValidConsent } from '../consents/valid';
import { getMembershipOverview } from '../memberships/overview';
import { formatCardNumber, type CardFacts } from './card-rules';

export { federationEmail } from '../training/access-facts';

/* Reads shared by the request and the decision (docs/03 section 19.1). */

/** The member row locked: an application and a decision for one member wait for each other. */
export async function lockCardMember(tx: LimitDb, userId: string) {
	const [row] = await tx
		.select({
			email: users.email,
			locale: users.locale,
			firstName: users.firstName,
			lastName: users.lastName,
			name: users.name,
			status: users.status,
			birthDate: users.birthDate,
			emailVerified: users.emailVerified,
			avatarKey: users.avatarKey
		})
		.from(users)
		.where(and(eq(users.id, userId), isNull(users.deletedAt)))
		.for('update');
	return row ?? null;
}
export type CardMember = NonNullable<Awaited<ReturnType<typeof lockCardMember>>>;

export async function cardFacts(
	tx: LimitDb,
	userId: string,
	member: Omit<CardFacts, 'paidUntil' | 'privacy'>,
	now: Date
): Promise<CardFacts> {
	const [membership, privacy] = await Promise.all([
		getMembershipOverview(tx, userId, now),
		hasValidConsent(tx, userId, 'privacy', now)
	]);
	return { ...member, paidUntil: membership.paidUntil, privacy };
}

/** docs/03 section 19.1 p. 3: one issue at a time takes the next number of the year (advisory lock
 * till the commit), as certificates do; unique(`number`) is the last guard. */
export async function nextCardNumber(tx: LimitDb, issuedAt: Date): Promise<string> {
	const year = certificateYear(issuedAt);
	await tx.execute(sql`select pg_advisory_xact_lock(hashtext('volunteer_card_number'))`);
	const [row] = await tx
		.select({ last: sql<number | null>`max(split_part(${volunteerCards.number}, '-', 4)::int)` })
		.from(volunteerCards)
		.where(sql`${volunteerCards.number} ~ ${`^APU-V-${year}-[0-9]+$`}`);
	return formatCardNumber(year, Number(row?.last ?? 0) + 1);
}
