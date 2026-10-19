import { PUBLIC_SITE_URL } from '$app/env/private';
import type { LimitDb } from '../../auth/rate-limit';
import type { paymentKind } from '../../db/schema/enums';
import type { payments } from '../../db/schema/payments';
import { sendMail } from '../../mail';
import { donationEffects } from '../donations/effects';
import { membershipEffects } from '../memberships/effects';
import { membershipPeriodMonths } from '../memberships/fee';

export type PaymentRow = typeof payments.$inferSelect;
export type PaymentKind = (typeof paymentKind.enumValues)[number];
type EffectStatus = 'paid' | 'failed' | 'cancelled' | 'refunded';

/** Work for after the commit (letters); skipped when the change rolls back. */
export type AfterCommit = (job: () => Promise<void>) => void;

/**
 * Runs inside the transaction of the status change (docs/07 section 1 p. 7): throwing rolls the
 * change back. Mail goes through `after`, never from the transaction itself.
 */
export type PaymentEffect = (tx: LimitDb, payment: PaymentRow, after: AfterCommit) => Promise<void>;
export type PaymentEffects = Partial<
	Record<PaymentKind, Partial<Record<EffectStatus, PaymentEffect>>>
>;

/** Event fee — stage 5. */
export const paymentEffects: PaymentEffects = {
	membership: membershipEffects({
		send: sendMail,
		siteUrl: PUBLIC_SITE_URL,
		periodMonths: membershipPeriodMonths
	}),
	donation: donationEffects({ send: sendMail })
};

export async function runEffects(
	tx: LimitDb,
	effects: PaymentEffects,
	payment: PaymentRow,
	after: AfterCommit
) {
	if (payment.status === 'pending') return;
	await effects[payment.kind]?.[payment.status]?.(tx, payment, after);
}

/** The status change transaction with its after-commit jobs; a failing job is only logged. */
export async function withAfterCommit<T>(work: (after: AfterCommit) => Promise<T>): Promise<T> {
	const jobs: (() => Promise<void>)[] = [];
	const result = await work((job) => jobs.push(job));
	for (const job of jobs) {
		try {
			await job();
		} catch (error) {
			console.error('payment: after-commit job failed', error);
		}
	}
	return result;
}
