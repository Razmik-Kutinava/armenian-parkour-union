import { isLocale, localizePath, type Locale } from '#lib/i18n/locales.ts';
import { translate } from '#lib/i18n/translate.ts';
import type { Mail } from '../../mail/resend';

/* docs/03 section 19.9 p. 2: a new request — to the federation; issued, rejected, revoked (with the
 * reason) — to the member, in their language. Sent after the commit. */

export type CardRecipient = {
	email: string;
	locale: string;
	firstName: string | null;
	lastName: string | null;
	name: string;
};
export type CardDecisionMail =
	| { status: 'active'; number: string; validUntil: Date | null }
	| { status: 'rejected' | 'revoked'; reason: string };

const fullName = (m: CardRecipient) =>
	[m.firstName, m.lastName].filter(Boolean).join(' ') || m.name;

/** The federation address has no language: English, as for a guest (decision 3.7). */
export function cardRequestLetter(
	to: string,
	member: CardRecipient,
	cardId: string,
	siteUrl: string | undefined
): Mail {
	const params = {
		name: fullName(member),
		url: `${siteUrl ?? ''}/admin/volunteer/cards/${cardId}`
	};
	return {
		to,
		subject: translate('en', 'volunteerCards.mail.request.subject'),
		text: translate('en', 'volunteerCards.mail.request.text', params)
	};
}

export function cardDecisionLetter(
	member: CardRecipient,
	decision: CardDecisionMail,
	siteUrl: string | undefined
): Mail {
	const locale: Locale = isLocale(member.locale) ? member.locale : 'en';
	const issued = decision.status === 'active';
	const params = {
		name: member.firstName ?? member.name,
		url: `${siteUrl ?? ''}${localizePath('/cabinet/volunteer', locale)}`,
		number: issued ? decision.number : '',
		date:
			issued && decision.validUntil
				? decision.validUntil.toLocaleDateString(locale, {
						dateStyle: 'long',
						timeZone: 'Asia/Yerevan'
					})
				: '',
		reason: issued ? '' : decision.reason
	};
	return {
		to: member.email,
		subject: translate(locale, `volunteerCards.mail.${decision.status}.subject`),
		text: translate(locale, `volunteerCards.mail.${decision.status}.text`, params)
	};
}
