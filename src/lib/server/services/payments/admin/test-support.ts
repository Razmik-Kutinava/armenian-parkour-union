import type { LimitDb } from '../../../auth/rate-limit';
import type { UserRole } from '../../../auth/session';
import { payments } from '../../../db/schema/payments';
import { insertUser } from '../../../db/test-db';
import type { Mail } from '../../../mail/resend';
import { donationEffects } from '../../donations/effects';
import { effectsWith } from '../../memberships/test-support';
import { eventFeeEffects } from '../../registrations/payment-effects';
import { SETTINGS, SITE } from '../../registrations/test-support';
import type { PaymentEffects } from '../effects';
import { withRefundLetter } from '../refund-letter';
import type { ManualPaymentInput } from './manual';

/* Test support only: admin payment tests run inside a rolled-back transaction. */

export async function staff(tx: LimitDb, role: UserRole = 'admin') {
	const user = await insertUser(tx, { role, emailVerified: true });
	return { id: user.id, role };
}

/** The production set of effects, letters into `send`. */
export function allEffects(send: (mail: Mail) => Promise<void>): PaymentEffects {
	const eventFee = eventFeeEffects({ send, siteUrl: SITE, settings: async () => SETTINGS });
	return withRefundLetter(
		{ ...effectsWith(send), donation: donationEffects({ send }), event_fee: eventFee },
		send
	);
}

export async function insertPayment(
	tx: LimitDb,
	values: Partial<typeof payments.$inferInsert> = {}
) {
	const [row] = await tx
		.insert(payments)
		.values({
			kind: 'donation',
			amountMinor: 5000,
			currency: 'AMD',
			provider: 'manual',
			donorName: 'Anna Guest',
			donorEmail: 'anna.guest@example.com',
			...values
		})
		.returning();
	return row;
}

export const manualDonation = (extra: Partial<ManualPaymentInput> = {}): ManualPaymentInput => ({
	kind: 'donation',
	amountMinor: 25_000,
	currency: 'AMD',
	paidOn: '2026-10-01',
	comment: 'Bank transfer #1042',
	payerEmail: null,
	donorName: 'Cash Donor',
	donorEmail: 'cash.donor@example.com',
	isAnonymous: false,
	purposeId: null,
	...extra
});
