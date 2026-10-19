import { eq } from 'drizzle-orm';
import type { LimitDb } from '../../auth/rate-limit';
import { payments } from '../../db/schema/payments';
import { runEffects, type PaymentEffects } from './effects';
import { logStatusChange } from './status-log';

/**
 * docs/07 section 7 p. 3: call only after the provider said the payment is not paid. The row is
 * locked and checked again, so a webhook that confirmed it meanwhile wins.
 */
export async function expirePayment(
	db: LimitDb,
	id: string,
	now: Date,
	effects: PaymentEffects
): Promise<boolean> {
	return db.transaction(async (tx) => {
		const [payment] = await tx.select().from(payments).where(eq(payments.id, id)).for('update');
		if (payment?.status !== 'pending' || !payment.expiresAt || payment.expiresAt > now) {
			return false;
		}
		const [updated] = await tx
			.update(payments)
			.set({ status: 'cancelled', failureReason: 'expired' })
			.where(eq(payments.id, id))
			.returning();
		await runEffects(tx, effects, updated);
		await logStatusChange(tx, id, payment, updated);
		return true;
	});
}
