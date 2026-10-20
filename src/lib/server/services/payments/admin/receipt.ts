import { and, eq, isNotNull, isNull } from 'drizzle-orm';
import type { LimitDb } from '../../../auth/rate-limit';
import { memberships, payments } from '../../../db/schema/payments';
import { users } from '../../../db/schema/users';
import type { Mail } from '../../../mail/resend';
import { writeAudit } from '../../audit';
import { thanksLetter } from '../../donations/mail';
import { paidLetter } from '../../memberships/mail';
import { isUuid, type Actor } from '../../users/target';
import type { PaymentRow } from '../effects';
import { canManage, type AdminPaymentResult } from './support';

export type ReceiptDeps = {
	send: (mail: Mail) => Promise<void>;
	siteUrl: string | undefined;
	ip: string | null;
};

/** The fee letter needs the period this payment bought; `unsupported` when there is none. */
async function membershipLetter(
	db: LimitDb,
	payment: PaymentRow,
	siteUrl: string | undefined
): Promise<Mail | 'unsupported' | 'no_recipient'> {
	const [period] = await db
		.select({ startsAt: memberships.startsAt, endsAt: memberships.endsAt })
		.from(memberships)
		.where(
			and(
				eq(memberships.paymentId, payment.id),
				isNotNull(memberships.startsAt),
				isNotNull(memberships.endsAt)
			)
		);
	if (!period || !payment.userId) return 'unsupported';
	const [user] = await db
		.select()
		.from(users)
		.where(and(eq(users.id, payment.userId), isNull(users.deletedAt)));
	if (!user) return 'no_recipient';
	return paidLetter(
		db,
		user,
		{
			paymentId: payment.id,
			amountMinor: payment.amountMinor,
			currency: payment.currency,
			paidAt: payment.paidAt ?? new Date(),
			startsAt: period.startsAt!,
			endsAt: period.endsAt!
		},
		siteUrl
	);
}

/** docs/05 section 16, docs/07 section 12 p. 1: the receipt letter of a paid payment, again. */
export async function resendReceipt(
	db: LimitDb,
	actor: Actor,
	paymentId: string,
	deps: ReceiptDeps
): Promise<AdminPaymentResult> {
	if (!canManage(actor)) return 'not_allowed';
	if (!isUuid(paymentId)) return 'not_found';
	const [payment] = await db.select().from(payments).where(eq(payments.id, paymentId));
	if (!payment) return 'not_found';
	if (payment.status !== 'paid') return 'wrong_status';
	let letter: Mail | 'unsupported' | 'no_recipient';
	if (payment.kind === 'donation') letter = (await thanksLetter(db, payment)) ?? 'no_recipient';
	else if (payment.kind === 'membership')
		letter = await membershipLetter(db, payment, deps.siteUrl);
	else letter = 'unsupported';
	if (typeof letter === 'string') return letter;
	try {
		await deps.send(letter);
	} catch (error) {
		console.error(`payment ${payment.id}: receipt not sent`, error);
		return 'mail_failed';
	}
	await writeAudit(db, {
		actorId: actor.id,
		action: 'payment.receipt_resend',
		entityType: 'payment',
		entityId: payment.id,
		ip: deps.ip
	});
	return 'ok';
}
