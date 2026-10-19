import type { LimitDb } from '../../auth/rate-limit';
import type { paymentKind } from '../../db/schema/enums';
import type { payments } from '../../db/schema/payments';

export type PaymentRow = typeof payments.$inferSelect;
export type PaymentKind = (typeof paymentKind.enumValues)[number];
type EffectStatus = 'paid' | 'failed' | 'cancelled' | 'refunded';

/**
 * Runs inside the transaction of the status change (docs/07 section 1 p. 7): throwing rolls the
 * change back. No mail here — mail goes after the commit.
 */
export type PaymentEffect = (tx: LimitDb, payment: PaymentRow) => Promise<void>;
export type PaymentEffects = Partial<
	Record<PaymentKind, Partial<Record<EffectStatus, PaymentEffect>>>
>;

/** Filled by the scenarios: membership (3.6), event fee (stage 5). */
export const paymentEffects: PaymentEffects = {};

export async function runEffects(tx: LimitDb, effects: PaymentEffects, payment: PaymentRow) {
	if (payment.status === 'pending') return;
	await effects[payment.kind]?.[payment.status]?.(tx, payment);
}
