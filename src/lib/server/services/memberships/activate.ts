import { and, eq, gt, ne, sql } from 'drizzle-orm';
import type { LimitDb } from '../../auth/rate-limit';
import { memberships, payments } from '../../db/schema/payments';
import { users } from '../../db/schema/users';
import { writeAudit } from '../audit';
import type { AfterCommit, PaymentRow } from '../payments/effects';
import { logMembershipStatus } from './log';
import { paidLetter, type MembershipMailDeps } from './mail';

/** `periodMonths` — `membership_fee.period_months` at confirmation time (`null` — broken). */
export type MembershipEffectDeps = MembershipMailDeps & {
	periodMonths: (tx: LimitDb) => Promise<number | null>;
};

type Review = 'membership_missing' | 'user_blocked' | 'membership_already_active' | 'late_payment';

/** docs/07 section 8: money is kept, an admin decides (list "Needs review", 3.9). */
async function needsReview(tx: LimitDb, payment: PaymentRow, reason: Review) {
	await tx.update(payments).set({ needsReview: true }).where(eq(payments.id, payment.id));
	await writeAudit(tx, {
		actorId: null,
		action: reason === 'late_payment' ? 'membership.late_payment' : 'membership.not_activated',
		entityType: 'payment',
		entityId: payment.id,
		after: { reason, membershipId: payment.membershipId }
	});
}

/** Paid days are never lost: a renewal starts where the latest active membership ends. */
async function periodStart(tx: LimitDb, userId: string, exceptId: string, now: Date) {
	const [latest] = await tx
		.select({ endsAt: sql<Date | null>`max(${memberships.endsAt})`.mapWith(memberships.endsAt) })
		.from(memberships)
		.where(
			and(
				eq(memberships.userId, userId),
				eq(memberships.status, 'active'),
				ne(memberships.id, exceptId),
				gt(memberships.endsAt, now)
			)
		);
	return latest?.endsAt ?? now;
}

/**
 * docs/03 section 2 p. 2, docs/07 section 5.1 p. 4: inside the payment transaction. User and
 * membership rows are locked, so two confirmations of one user count periods one after another.
 */
export async function activateMembership(
	tx: LimitDb,
	payment: PaymentRow,
	after: AfterCommit,
	deps: MembershipEffectDeps
) {
	if (!payment.userId || !payment.membershipId)
		return needsReview(tx, payment, 'membership_missing');
	const [user] = await tx
		.select()
		.from(users)
		.where(eq(users.id, payment.userId))
		.for('no key update');
	const [membership] = await tx
		.select()
		.from(memberships)
		.where(and(eq(memberships.id, payment.membershipId), eq(memberships.userId, payment.userId)))
		.for('update');
	if (!user || !membership) return needsReview(tx, payment, 'membership_missing');
	if (user.status !== 'active' || user.deletedAt) return needsReview(tx, payment, 'user_blocked');
	if (membership.status === 'active' || membership.status === 'expired') {
		return needsReview(tx, payment, 'membership_already_active');
	}
	const months = await deps.periodMonths(tx);
	if (months === null) throw new Error('site_settings.membership_fee.period_months is broken');
	const startsAt = await periodStart(tx, user.id, membership.id, new Date());
	const [activated] = await tx
		.update(memberships)
		.set({
			status: 'active',
			startsAt,
			endsAt: sql`${startsAt.toISOString()}::timestamptz + make_interval(months => ${months}::int)`,
			paymentId: payment.id
		})
		.where(eq(memberships.id, membership.id))
		.returning();
	await logMembershipStatus(tx, membership.id, membership.status, 'active', {
		startsAt,
		endsAt: activated.endsAt,
		paymentId: payment.id
	});
	if (!user.level) {
		await tx.update(users).set({ level: 'novice' }).where(eq(users.id, user.id));
		await writeAudit(tx, {
			actorId: null,
			action: 'user.level',
			entityType: 'user',
			entityId: user.id,
			before: { level: null },
			after: { level: 'novice' }
		});
	}
	if (membership.status === 'cancelled') await needsReview(tx, payment, 'late_payment');
	const letter = await paidLetter(
		tx,
		user,
		{
			paymentId: payment.id,
			amountMinor: payment.amountMinor,
			currency: payment.currency,
			paidAt: payment.paidAt ?? new Date(),
			startsAt,
			endsAt: activated.endsAt!
		},
		deps.siteUrl
	);
	after(() => deps.send(letter));
}
