import { isLocale, localizePath, type Locale } from '#lib/i18n/locales.ts';
import { translate } from '#lib/i18n/translate.ts';
import { formatPrice } from '#lib/money.ts';
import type { LimitDb } from '../../auth/rate-limit';
import type { Mail } from '../../mail/resend';
import { getFooterSettings } from '../site-settings';

export type MembershipMailDeps = {
	send: (mail: Mail) => Promise<void>;
	siteUrl: string | undefined;
};

export type Recipient = { email: string; locale: string; firstName: string | null; name: string };

const languageOf = (recipient: Recipient): Locale =>
	isLocale(recipient.locale) ? recipient.locale : 'en';

const day = (date: Date, locale: Locale) =>
	date.toLocaleDateString(locale, { dateStyle: 'long', timeZone: 'Asia/Yerevan' });

const cabinetUrl = (siteUrl: string | undefined, locale: Locale) =>
	`${siteUrl ?? ''}${localizePath('/cabinet/membership', locale)}`;

type Paid = {
	paymentId: string;
	amountMinor: number;
	currency: string;
	paidAt: Date;
	startsAt: Date;
	endsAt: Date;
};

/** docs/07 section 12 p. 1: amount, date, purpose, payment number and the federation details. */
export async function paidLetter(
	tx: LimitDb,
	to: Recipient,
	paid: Paid,
	siteUrl: string | undefined
): Promise<Mail> {
	const locale = languageOf(to);
	const { requisites } = await getFooterSettings(tx, locale);
	const t = (key: Parameters<typeof translate>[1], params = {}) => translate(locale, key, params);
	const text = t('membership.mail.paid.text', {
		name: to.firstName ?? to.name,
		amount: formatPrice(paid.amountMinor, paid.currency, locale),
		date: day(paid.paidAt, locale),
		from: day(paid.startsAt, locale),
		to: day(paid.endsAt, locale),
		payment: paid.paymentId,
		url: cabinetUrl(siteUrl, locale)
	});
	const details = requisites ? `\n\n${t('membership.mail.requisites')}\n${requisites}` : '';
	return { to: to.email, subject: t('membership.mail.paid.subject'), text: text + details };
}

/** docs/03 section 2 p. 4: 30 and 7 days before the end. */
export function reminderLetter(to: Recipient, endsAt: Date, siteUrl: string | undefined): Mail {
	const locale = languageOf(to);
	const params = {
		name: to.firstName ?? to.name,
		date: day(endsAt, locale),
		url: cabinetUrl(siteUrl, locale)
	};
	return {
		to: to.email,
		subject: translate(locale, 'membership.mail.reminder.subject', params),
		text: translate(locale, 'membership.mail.reminder.text', params)
	};
}
