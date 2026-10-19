import { and, desc, eq, gt, isNotNull, isNull } from 'drizzle-orm';
import type { LimitDb } from '../../auth/rate-limit';
import { payments } from '../../db/schema/payments';
import type { NewOnlinePayment } from './create';

const checkoutOf = (payload: unknown): string | null => {
	const url = (payload as { checkoutUrl?: unknown } | null)?.checkoutUrl;
	return typeof url === 'string' ? url : null;
};

/** docs/07 section 5.1 p. 6: pressing "Pay" again goes to the same unexpired membership payment. */
export async function reusablePayment(tx: LimitDb, input: NewOnlinePayment, providerId: string) {
	if (input.kind !== 'membership' || !input.userId) return null;
	const [row] = await tx
		.select({ id: payments.id, payload: payments.providerPayload })
		.from(payments)
		.where(
			and(
				eq(payments.userId, input.userId),
				eq(payments.kind, 'membership'),
				eq(payments.status, 'pending'),
				eq(payments.provider, providerId),
				eq(payments.amountMinor, input.amountMinor),
				eq(payments.currency, input.currency),
				isNotNull(payments.providerPaymentId),
				gt(payments.expiresAt, new Date()),
				input.membershipId
					? eq(payments.membershipId, input.membershipId)
					: isNull(payments.membershipId)
			)
		)
		.orderBy(desc(payments.createdAt))
		.limit(1);
	const checkoutUrl = checkoutOf(row?.payload);
	return row && checkoutUrl ? { paymentId: row.id, checkoutUrl } : null;
}
