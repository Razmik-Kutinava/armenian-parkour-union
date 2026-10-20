import { and, eq, inArray, isNotNull } from 'drizzle-orm';
import { pickLocalized, type LocalizedText } from '#lib/i18n/localized.ts';
import type { Locale } from '#lib/i18n/locales.ts';
import { translate } from '#lib/i18n/translate.ts';
import type { LimitDb } from '../../auth/rate-limit';
import { donationPurposes, memberships, payments } from '../../db/schema/payments';
import { users } from '../../db/schema/users';
import type { PaymentRow } from '../payments/effects';
import { getFooterSettings } from '../site-settings';
import { isUuid } from '../users/target';

export type Receipt = Pick<PaymentRow, 'id' | 'kind' | 'status' | 'amountMinor' | 'currency'> & {
	paidAt: Date;
	refundedAt: Date | null;
	payerName: string;
	/** Donation only: the purpose, or the general needs. */
	purpose: string | null;
	/** Fee only: the period this payment bought. */
	period: { startsAt: Date; endsAt: Date } | null;
	requisites: string | null;
};

async function purposeOf(db: LimitDb, purposeId: string | null, locale: Locale): Promise<string> {
	if (purposeId) {
		const [row] = await db
			.select({ title: donationPurposes.title })
			.from(donationPurposes)
			.where(eq(donationPurposes.id, purposeId));
		if (row) return pickLocalized(row.title as LocalizedText, locale);
	}
	return translate(locale, 'donate.purpose.general');
}

async function periodOf(db: LimitDb, paymentId: string): Promise<Receipt['period']> {
	const [row] = await db
		.select({ startsAt: memberships.startsAt, endsAt: memberships.endsAt })
		.from(memberships)
		.where(
			and(
				eq(memberships.paymentId, paymentId),
				isNotNull(memberships.startsAt),
				isNotNull(memberships.endsAt)
			)
		);
	return row ? { startsAt: row.startsAt!, endsAt: row.endsAt! } : null;
}

/**
 * docs/07 section 12 p. 1: a copy of the receipt — amount, date, purpose, number, federation
 * details. Only the signed-in member's own paid or refunded payment; anything else is `null` (404).
 */
export async function getOwnReceipt(
	db: LimitDb,
	userId: string,
	paymentId: string,
	locale: Locale
): Promise<Receipt | null> {
	if (!isUuid(userId) || !isUuid(paymentId)) return null;
	const [row] = await db
		.select({
			id: payments.id,
			kind: payments.kind,
			status: payments.status,
			amountMinor: payments.amountMinor,
			currency: payments.currency,
			paidAt: payments.paidAt,
			refundedAt: payments.refundedAt,
			purposeId: payments.donationPurposeId,
			payerName: users.name
		})
		.from(payments)
		.innerJoin(users, eq(users.id, payments.userId))
		.where(
			and(
				eq(payments.id, paymentId),
				eq(payments.userId, userId),
				inArray(payments.status, ['paid', 'refunded']),
				isNotNull(payments.paidAt)
			)
		);
	if (!row) return null;
	const { purposeId, ...payment } = row;
	const [purpose, period, footer] = await Promise.all([
		payment.kind === 'donation' ? purposeOf(db, purposeId, locale) : null,
		payment.kind === 'membership' ? periodOf(db, payment.id) : null,
		getFooterSettings(db, locale)
	]);
	return { ...payment, paidAt: payment.paidAt!, purpose, period, requisites: footer.requisites };
}
