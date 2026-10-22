import { and, eq, isNull, or } from 'drizzle-orm';
import { isMinor } from '#lib/validation/auth.ts';
import type { LimitDb } from '../../auth/rate-limit';
import type { MembershipLevel } from '../../auth/session';
import { consents } from '../../db/schema/consents';
import { users } from '../../db/schema/users';
import { inForce } from '../consents/valid';
import { getMembershipOverview, type MembershipOverview } from '../memberships/overview';
import { isUuid } from '../users/target';
import { membershipReminder, type MembershipReminder } from './reminder';

/** Registrations and exams join the list in stages 5–6 (docs/06 section 5.1). */
export type CabinetAction =
	'verify_email' | 'membership_expired' | 'membership_ends_soon' | 'join' | 'consent_parental';

export type CabinetOverview = {
	firstName: string | null;
	name: string;
	avatarKey: string | null;
	level: MembershipLevel | null;
	pointsBalance: number;
	emailVerified: boolean;
	membership: MembershipOverview;
	reminder: MembershipReminder;
	actions: CabinetAction[];
};

/** docs/03 section 13 p. 2: a minor needs a parental consent in force; one under review is enough here. */
async function needsParentalConsent(db: LimitDb, userId: string, now: Date) {
	const [row] = await db
		.select({ id: consents.id })
		.from(consents)
		.where(
			and(
				eq(consents.userId, userId),
				eq(consents.kind, 'parental'),
				or(eq(consents.status, 'pending'), inForce(now))
			)
		)
		.limit(1);
	return !row;
}

/** docs/06 section 5.1: the signed-in member's own data; `null` for a deleted or unknown id. */
export async function getCabinetOverview(
	db: LimitDb,
	userId: string,
	now = new Date()
): Promise<CabinetOverview | null> {
	if (!isUuid(userId)) return null;
	const [user] = await db
		.select({
			firstName: users.firstName,
			name: users.name,
			avatarKey: users.avatarKey,
			level: users.level,
			pointsBalance: users.pointsBalance,
			emailVerified: users.emailVerified,
			birthDate: users.birthDate
		})
		.from(users)
		.where(and(eq(users.id, userId), isNull(users.deletedAt)));
	if (!user) return null;
	const { birthDate, ...own } = user;
	const membership = await getMembershipOverview(db, userId, now);
	const reminder = membershipReminder(membership, now);
	const actions: CabinetAction[] = [];
	if (!user.emailVerified) actions.push('verify_email');
	if (reminder?.kind === 'expired') actions.push('membership_expired');
	else if (reminder?.kind === 'ends_soon') actions.push('membership_ends_soon');
	else if (!membership.active && !membership.waiting) actions.push('join');
	if (birthDate && isMinor(birthDate, now) && (await needsParentalConsent(db, userId, now))) {
		actions.push('consent_parental');
	}
	return { ...own, membership, reminder, actions };
}
