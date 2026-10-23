import { translate } from '#lib/i18n/translate.ts';
import { formatPrice } from '#lib/money.ts';
import type { LimitDb } from '../../auth/rate-limit';
import type { Mail } from '../../mail/resend';
import type { PaymentRow } from '../payments/effects';
import { getFooterSettings } from '../site-settings';
import {
	eventLetter,
	languageOf,
	moment,
	OWN_EVENTS,
	type EventRef,
	type RegistrationRecipient
} from './mail';

/**
 * docs/07 sections 5.3 p. 3, 12 p. 1: the fee counted — the member is registered; the receipt has
 * the amount, date, purpose, payment number and the federation details.
 */
export async function feePaidLetter(
	tx: LimitDb,
	to: RegistrationRecipient,
	event: EventRef,
	payment: PaymentRow,
	siteUrl: string | undefined
): Promise<Mail> {
	const locale = languageOf(to);
	const { requisites } = await getFooterSettings(tx, locale);
	const mail = eventLetter(
		to,
		event,
		{ subject: 'registrations.mail.paid.subject', text: 'registrations.mail.paid.text' },
		{ path: OWN_EVENTS, siteUrl },
		() => ({
			amount: formatPrice(payment.amountMinor, payment.currency, locale),
			paidAt: moment(payment.paidAt ?? new Date(), locale),
			payment: payment.id
		})
	);
	if (!requisites) return mail;
	const details = `${translate(locale, 'registrations.mail.requisites')}\n${requisites}`;
	return { ...mail, text: `${mail.text}\n\n${details}` };
}
