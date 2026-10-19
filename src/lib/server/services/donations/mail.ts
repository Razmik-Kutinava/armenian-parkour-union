import { eq } from 'drizzle-orm';
import { pickLocalized, type LocalizedText } from '#lib/i18n/localized.ts';
import { isLocale, type Locale } from '#lib/i18n/locales.ts';
import { translate } from '#lib/i18n/translate.ts';
import { formatPrice } from '#lib/money.ts';
import type { LimitDb } from '../../auth/rate-limit';
import { donationPurposes } from '../../db/schema/payments';
import { users } from '../../db/schema/users';
import type { Mail } from '../../mail/resend';
import type { PaymentRow } from '../payments/effects';
import { getFooterSettings } from '../site-settings';

type Recipient = { email: string; locale: Locale; name: string };

/**
 * docs/07 section 5.2 p. 4: a member by the account (none once deleted), a guest by the form. A
 * payment keeps no language, so a guest gets English (questions.md, 3.7).
 */
async function recipient(tx: LimitDb, payment: PaymentRow): Promise<Recipient | null> {
	if (!payment.userId) {
		if (!payment.donorEmail) return null;
		return { email: payment.donorEmail, locale: 'en', name: payment.donorName ?? '' };
	}
	const [user] = await tx.select().from(users).where(eq(users.id, payment.userId));
	if (!user || user.deletedAt) return null;
	const locale = isLocale(user.locale) ? user.locale : 'en';
	return { email: user.email, locale, name: user.firstName ?? user.name };
}

async function purposeTitle(tx: LimitDb, payment: PaymentRow, locale: Locale): Promise<string> {
	if (payment.donationPurposeId) {
		const [purpose] = await tx
			.select({ title: donationPurposes.title })
			.from(donationPurposes)
			.where(eq(donationPurposes.id, payment.donationPurposeId));
		if (purpose) return pickLocalized(purpose.title as LocalizedText, locale);
	}
	return translate(locale, 'donate.mail.generalPurpose');
}

/** docs/07 sections 5.2 p. 3, 12 p. 1: thanks and the receipt — amount, date, purpose, number, details. */
export async function thanksLetter(tx: LimitDb, payment: PaymentRow): Promise<Mail | null> {
	const to = await recipient(tx, payment);
	if (!to) return null;
	const { locale } = to;
	const { requisites } = await getFooterSettings(tx, locale);
	const paidAt = payment.paidAt ?? new Date();
	const text = translate(locale, 'donate.mail.text', {
		name: to.name,
		amount: formatPrice(payment.amountMinor, payment.currency, locale),
		date: paidAt.toLocaleDateString(locale, { dateStyle: 'long', timeZone: 'Asia/Yerevan' }),
		purpose: await purposeTitle(tx, payment, locale),
		payment: payment.id
	});
	const details = requisites
		? `\n\n${translate(locale, 'donate.mail.requisites')}\n${requisites}`
		: '';
	return { to: to.email, subject: translate(locale, 'donate.mail.subject'), text: text + details };
}
