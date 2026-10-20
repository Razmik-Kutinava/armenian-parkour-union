import type { LimitDb } from '../../auth/rate-limit';
import { getMembershipOverview, type MembershipOverview } from '../memberships/overview';

/** Same as the first "ends soon" letter (docs/03 section 2 p. 4). */
export const REMIND_DAYS = 30;

export type MembershipReminder = { kind: 'expired' | 'ends_soon'; date: Date } | null;

/**
 * docs/06 section 2: a soft reminder when the membership has ended or ends soon. A refund
 * (`cancelled`) ends it on purpose, and a payment awaiting confirmation is already a renewal.
 */
export function membershipReminder(
	overview: MembershipOverview,
	now = new Date()
): MembershipReminder {
	if (overview.waiting) return null;
	if (overview.active && overview.paidUntil) {
		const soon = now.getTime() + REMIND_DAYS * 86_400_000;
		return overview.paidUntil.getTime() <= soon
			? { kind: 'ends_soon', date: overview.paidUntil }
			: null;
	}
	const ended = overview.history
		.filter((p) => (p.status === 'active' || p.status === 'expired') && p.endsAt && p.endsAt <= now)
		.map((p) => p.endsAt!.getTime());
	return ended.length ? { kind: 'expired', date: new Date(Math.max(...ended)) } : null;
}

/** The site banner: the signed-in member's own memberships only. */
export async function loadMembershipReminder(
	db: LimitDb,
	userId: string,
	now = new Date()
): Promise<MembershipReminder> {
	return membershipReminder(await getMembershipOverview(db, userId, now), now);
}
