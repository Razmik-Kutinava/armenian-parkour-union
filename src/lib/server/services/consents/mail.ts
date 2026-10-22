import { isLocale, localizePath, type Locale } from '#lib/i18n/locales.ts';
import { translate } from '#lib/i18n/translate.ts';
import type { ConsentKind } from '#lib/validation/consents.ts';
import type { Mail } from '../../mail/resend';

export type ConsentRecipient = {
	email: string;
	locale: string;
	firstName: string | null;
	name: string;
};

export type Decision =
	{ status: 'approved'; validUntil: Date | null } | { status: 'rejected'; note: string };

const day = (date: Date, locale: Locale) =>
	date.toLocaleDateString(locale, { dateStyle: 'long', timeZone: 'Asia/Yerevan' });

/** docs/05 section 10: the member learns the decision, the term or the reason, in their language. */
export function decisionLetter(
	to: ConsentRecipient,
	kind: ConsentKind,
	decision: Decision,
	siteUrl: string | undefined
): Mail {
	const locale: Locale = isLocale(to.locale) ? to.locale : 'en';
	const params = {
		name: to.firstName ?? to.name,
		kind: translate(locale, `consents.kind.${kind}`),
		url: `${siteUrl ?? ''}${localizePath('/cabinet/documents', locale)}`,
		date:
			decision.status === 'approved' && decision.validUntil ? day(decision.validUntil, locale) : '',
		note: decision.status === 'rejected' ? decision.note : ''
	};
	if (decision.status === 'rejected') {
		return {
			to: to.email,
			subject: translate(locale, 'consents.mail.rejected.subject'),
			text: translate(locale, 'consents.mail.rejected.text', params)
		};
	}
	const text = decision.validUntil
		? 'consents.mail.approved.textUntil'
		: 'consents.mail.approved.text';
	return {
		to: to.email,
		subject: translate(locale, 'consents.mail.approved.subject'),
		text: translate(locale, text, params)
	};
}
