import { eq } from 'drizzle-orm';
import type { LimitDb } from '../../auth/rate-limit';
import { payments } from '../../db/schema/payments';
import { insertUser } from '../../db/test-db';
import type { ProviderReport } from './apply';
import { startOnlinePayment } from './create';
import type { PaymentEffects } from './effects';
import { createMockProvider } from './providers/mock';
import { SITE, donationPayment, membershipPayment, paymentRow } from './test-support';

/* Test support only: a started payment and what its provider may say about it. */

export async function started(tx: LimitDb, kind: 'membership' | 'donation' = 'membership') {
	const input =
		kind === 'membership' ? membershipPayment((await insertUser(tx)).id) : donationPayment();
	const result = await startOnlinePayment(tx, input, {
		provider: createMockProvider(),
		siteUrl: SITE
	});
	if (!result.ok) throw new Error(result.reason);
	const row = await paymentRow(tx, result.paymentId);
	const report = (
		status: ProviderReport['status'],
		extra: Partial<ProviderReport> = {}
	): ProviderReport => ({
		provider: 'mock',
		providerPaymentId: row.providerPaymentId!,
		status,
		amountMinor: row.amountMinor,
		currency: row.currency,
		raw: { status },
		...extra
	});
	return { id: row.id, report };
}

/** Membership effects that record which ran and the status they saw inside the transaction. */
export function countingEffects() {
	const calls: string[] = [];
	const effect = (name: string) => async (tx: LimitDb, payment: { id: string }) => {
		const [row] = await tx.select().from(payments).where(eq(payments.id, payment.id));
		calls.push(`${name}:${row.status}`);
	};
	const effects: PaymentEffects = {
		membership: {
			paid: effect('paid'),
			refunded: effect('refunded'),
			cancelled: effect('cancelled')
		}
	};
	return { calls, effects };
}
