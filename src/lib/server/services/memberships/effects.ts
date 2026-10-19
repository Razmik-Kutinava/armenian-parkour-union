import { and, eq, inArray } from 'drizzle-orm';
import type { LimitDb } from '../../auth/rate-limit';
import type { membershipStatus } from '../../db/schema/enums';
import { memberships } from '../../db/schema/payments';
import type { PaymentEffect, PaymentRow } from '../payments/effects';
import { activateMembership, type MembershipEffectDeps } from './activate';
import { logMembershipStatus } from './log';

type MembershipStatus = (typeof membershipStatus.enumValues)[number];

/** Only the membership this payment opened or activated; another payment's period stays. */
async function closeMembership(tx: LimitDb, payment: PaymentRow, from: MembershipStatus[]) {
	if (!payment.membershipId) return;
	const [membership] = await tx
		.select({ id: memberships.id, status: memberships.status })
		.from(memberships)
		.where(
			and(
				eq(memberships.id, payment.membershipId),
				eq(memberships.paymentId, payment.id),
				inArray(memberships.status, from)
			)
		)
		.for('update');
	if (!membership) return;
	await tx
		.update(memberships)
		.set({ status: 'cancelled' })
		.where(eq(memberships.id, membership.id));
	await logMembershipStatus(tx, membership.id, membership.status, 'cancelled', {
		paymentId: payment.id
	});
}

/**
 * docs/07 sections 5.1, 11 p. 3: paid — start or extend; cancelled (expired) — close the pending
 * one; refunded — end it (level and certificates stay, docs/03 section 2 p. 6). Failed — nothing:
 * the pending membership is closed by the daily job.
 */
export function membershipEffects(
	deps: MembershipEffectDeps
): Partial<Record<'paid' | 'cancelled' | 'refunded', PaymentEffect>> {
	return {
		paid: (tx, payment, after) => activateMembership(tx, payment, after, deps),
		cancelled: (tx, payment) => closeMembership(tx, payment, ['pending']),
		refunded: (tx, payment) => closeMembership(tx, payment, ['active', 'expired'])
	};
}
