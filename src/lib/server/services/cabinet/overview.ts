import { and, eq, isNull } from 'drizzle-orm';
import type { LimitDb } from '../../auth/rate-limit';
import type { MembershipLevel } from '../../auth/session';
import { users } from '../../db/schema/users';
import { getMembershipOverview, type MembershipOverview } from '../memberships/overview';
import { isUuid } from '../users/target';
import { membershipReminder, type MembershipReminder } from './reminder';

/** Registrations, consents and exams join the list in stages 5–6 (docs/06 section 5.1). */
export type CabinetAction = 'verify_email' | 'membership_expired' | 'membership_ends_soon' | 'join';

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
			emailVerified: users.emailVerified
		})
		.from(users)
		.where(and(eq(users.id, userId), isNull(users.deletedAt)));
	if (!user) return null;
	const membership = await getMembershipOverview(db, userId, now);
	const reminder = membershipReminder(membership, now);
	const actions: CabinetAction[] = [];
	if (!user.emailVerified) actions.push('verify_email');
	if (reminder?.kind === 'expired') actions.push('membership_expired');
	else if (reminder?.kind === 'ends_soon') actions.push('membership_ends_soon');
	else if (!membership.active && !membership.waiting) actions.push('join');
	return { ...user, membership, reminder, actions };
}
