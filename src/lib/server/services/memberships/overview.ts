import { and, desc, eq, gt, isNotNull } from 'drizzle-orm';
import type { LimitDb } from '../../auth/rate-limit';
import { memberships, payments } from '../../db/schema/payments';
import { isUuid } from '../users/target';

export type MembershipPeriod = {
	status: (typeof memberships.$inferSelect)['status'];
	startsAt: Date;
	endsAt: Date | null;
};

export type MembershipOverview = {
	/** An `active` row covers now: `/join` says "already a member". */
	active: boolean;
	/** Latest end among active rows: a renewal paid ahead extends it. */
	paidUntil: Date | null;
	/** A started fee payment still awaits the provider (docs/06 section 5.3). */
	waiting: boolean;
	history: MembershipPeriod[];
};

const HISTORY_LIMIT = 50;

/** docs/06 section 5.3: the member's own rows only; the id comes from the session. */
export async function getMembershipOverview(
	db: LimitDb,
	userId: string,
	now = new Date()
): Promise<MembershipOverview> {
	const empty: MembershipOverview = { active: false, paidUntil: null, waiting: false, history: [] };
	if (!isUuid(userId)) return empty;
	const own = eq(memberships.userId, userId);
	const [rows, waiting] = await Promise.all([
		db
			.select({
				status: memberships.status,
				startsAt: memberships.startsAt,
				endsAt: memberships.endsAt
			})
			.from(memberships)
			.where(and(own, isNotNull(memberships.startsAt)))
			.orderBy(desc(memberships.startsAt))
			.limit(HISTORY_LIMIT),
		db
			.select({ id: memberships.id })
			.from(memberships)
			.innerJoin(payments, eq(payments.membershipId, memberships.id))
			.where(
				and(
					own,
					eq(memberships.status, 'pending'),
					eq(payments.status, 'pending'),
					gt(payments.expiresAt, now)
				)
			)
			.limit(1)
	]);
	const history = rows as MembershipPeriod[];
	const live = history.filter((r) => r.status === 'active' && r.endsAt && r.endsAt > now);
	const active = live.some((r) => r.startsAt <= now);
	const ends = live.map((r) => r.endsAt!.getTime());
	return {
		active,
		paidUntil: active ? new Date(Math.max(...ends)) : null,
		waiting: waiting.length > 0,
		history
	};
}
