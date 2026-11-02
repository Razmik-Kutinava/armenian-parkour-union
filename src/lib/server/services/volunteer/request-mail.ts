import { isLocale, localizePath, type Locale } from '#lib/i18n/locales.ts';
import { pickLocalized, type LocalizedText } from '#lib/i18n/localized.ts';
import { translate } from '#lib/i18n/translate.ts';
import type { Mail } from '../../mail/resend';
import type { CardRecipient } from './card-mail';

/* docs/03 section 19.9 p. 2: invite — each invited member; cancel — accepted only. After commit. */

const fullName = (m: CardRecipient) =>
	[m.firstName, m.lastName].filter(Boolean).join(' ') || m.name;

function memberLetter(
	member: CardRecipient,
	kind: 'invite' | 'cancel',
	title: LocalizedText,
	siteUrl: string | undefined
): Mail {
	const locale: Locale = isLocale(member.locale) ? member.locale : 'en';
	const params = {
		name: member.firstName ?? fullName(member),
		title: pickLocalized(title, locale),
		url: `${siteUrl ?? ''}${localizePath('/cabinet/volunteer', locale)}`
	};
	return {
		to: member.email,
		subject: translate(locale, `volunteerRequests.mail.${kind}.subject`),
		text: translate(locale, `volunteerRequests.mail.${kind}.text`, params)
	};
}

export const inviteLetter = (
	member: CardRecipient,
	title: LocalizedText,
	siteUrl: string | undefined
) => memberLetter(member, 'invite', title, siteUrl);

export const cancelAcceptedLetter = (
	member: CardRecipient,
	title: LocalizedText,
	siteUrl: string | undefined
) => memberLetter(member, 'cancel', title, siteUrl);
