import { desc, eq } from 'drizzle-orm';
import type { LimitDb } from '../../auth/rate-limit';
import { payments } from '../../db/schema/payments';
import type { PaymentRow } from '../payments/effects';
import { isUuid } from '../users/target';

export type OwnPayment = Pick<
	PaymentRow,
	'id' | 'kind' | 'status' | 'amountMinor' | 'currency' | 'createdAt'
> & {
	/** A copy of the receipt exists once the money came in (docs/07 section 12 p. 1). */
	hasReceipt: boolean;
};

const LIMIT = 100;

/** docs/06 section 5.9: the signed-in member's payments, newest first; no donor or provider data. */
export async function listOwnPayments(db: LimitDb, userId: string): Promise<OwnPayment[]> {
	if (!isUuid(userId)) return [];
	const rows = await db
		.select({
			id: payments.id,
			kind: payments.kind,
			status: payments.status,
			amountMinor: payments.amountMinor,
			currency: payments.currency,
			createdAt: payments.createdAt,
			paidAt: payments.paidAt
		})
		.from(payments)
		.where(eq(payments.userId, userId))
		.orderBy(desc(payments.createdAt))
		.limit(LIMIT);
	return rows.map(({ paidAt, ...row }) => ({
		...row,
		hasReceipt: paidAt !== null && (row.status === 'paid' || row.status === 'refunded')
	}));
}
