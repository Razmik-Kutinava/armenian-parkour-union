import { and, desc, eq, gt, isNotNull, sql } from 'drizzle-orm';
import type { Locale } from '#lib/i18n/locales.ts';
import { translate } from '#lib/i18n/translate.ts';
import type { LimitDb } from '../../auth/rate-limit';
import { memberships, payments } from '../../db/schema/payments';
import { users } from '../../db/schema/users';
import { startOnlinePayment, type StartDeps } from '../payments/create';
import { isUuid } from '../users/target';
import type { MembershipFee } from './fee';

/** Settings read by the caller: `membership_fee` and `payment_wait_minutes` (`null` — broken). */
export type MembershipStartDeps = StartDeps & {
	fee: MembershipFee | null;
	waitMinutes: number | null;
};

type Refusal = 'not_found' | 'blocked' | 'email_unverified' | 'unavailable' | 'invalid';

export type MembershipStart =
	| { ok: true; paymentId: string; checkoutUrl: string; reused: boolean }
	| { ok: false; reason: Refusal | 'provider_error' };

class Refused extends Error {
	constructor(readonly reason: Refusal) {
		super(reason);
	}
}

async function payer(db: LimitDb, userId: string): Promise<Refusal | null> {
	if (!isUuid(userId)) return 'not_found';
	const [user] = await db
		.select({
			status: users.status,
			emailVerified: users.emailVerified,
			deletedAt: users.deletedAt
		})
		.from(users)
		.where(eq(users.id, userId));
	if (!user || user.deletedAt) return 'not_found';
	if (user.status !== 'active') return 'blocked';
	return user.emailVerified ? null : 'email_unverified';
}

/** A pending membership whose payment can still be paid at the same amount: pressing again reuses it. */
async function waitingMembership(
	tx: LimitDb,
	userId: string,
	fee: MembershipFee,
	providerId: string
): Promise<string | null> {
	const [row] = await tx
		.select({ id: memberships.id })
		.from(memberships)
		.innerJoin(payments, eq(payments.membershipId, memberships.id))
		.where(
			and(
				eq(memberships.userId, userId),
				eq(memberships.status, 'pending'),
				eq(payments.status, 'pending'),
				eq(payments.provider, providerId),
				eq(payments.amountMinor, fee.amountMinor),
				eq(payments.currency, fee.currency),
				isNotNull(payments.providerPaymentId),
				gt(payments.expiresAt, new Date())
			)
		)
		.orderBy(desc(payments.createdAt))
		.limit(1);
	return row?.id ?? null;
}

/**
 * docs/07 section 5.1 p. 1-3, 6: the amount comes from `membership_fee` only; the pending membership
 * gives no rights until the provider confirms the payment (effects.ts).
 */
export async function startMembershipPayment(
	db: LimitDb,
	userId: string,
	locale: Locale,
	deps: MembershipStartDeps
): Promise<MembershipStart> {
	const refusal = await payer(db, userId);
	if (refusal) return { ok: false, reason: refusal };
	const { fee, waitMinutes, provider } = deps;
	if (!fee || !waitMinutes || !provider) return { ok: false, reason: 'unavailable' };
	try {
		return await db.transaction(async (tx): Promise<MembershipStart> => {
			const key = `payment:${userId}:membership`;
			await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${key}))`);
			let membershipId = await waitingMembership(tx, userId, fee, provider.id);
			if (!membershipId) {
				const [created] = await tx
					.insert(memberships)
					.values({ userId })
					.returning({ id: memberships.id });
				membershipId = created.id;
			}
			const result = await startOnlinePayment(
				tx,
				{
					kind: 'membership',
					userId,
					amountMinor: fee.amountMinor,
					currency: fee.currency,
					description: translate(locale, 'membership.payment.description'),
					locale,
					holdMinutes: waitMinutes,
					membershipId
				},
				deps
			);
			if (!result.ok && !result.paymentId) {
				throw new Refused(result.reason === 'online_off' ? 'unavailable' : 'invalid');
			}
			await tx
				.update(memberships)
				.set({ paymentId: result.paymentId })
				.where(eq(memberships.id, membershipId));
			return result.ok ? result : { ok: false, reason: 'provider_error' };
		});
	} catch (error) {
		if (error instanceof Refused) return { ok: false, reason: error.reason };
		throw error;
	}
}
