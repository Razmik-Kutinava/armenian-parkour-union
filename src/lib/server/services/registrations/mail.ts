import { pickLocalized, type LocalizedText } from '#lib/i18n/localized.ts';
import { isLocale, localizePath, type Locale } from '#lib/i18n/locales.ts';
import { translate } from '#lib/i18n/translate.ts';
import type { Mail } from '../../mail/resend';

export type RegistrationRecipient = {
	email: string;
	locale: string;
	firstName: string | null;
	name: string;
};

type EventRef = { slug: string; title: unknown; startsAt: Date };

const moment = (date: Date, locale: Locale) =>
	date.toLocaleString(locale, { dateStyle: 'long', timeStyle: 'short', timeZone: 'Asia/Yerevan' });

/** docs/03 section 7.3, 14: "a seat is yours"; a paid event — pay before `holdUntil`. */
export function promotedLetter(
	to: RegistrationRecipient,
	event: EventRef,
	holdUntil: Date | null,
	siteUrl: string | undefined
): Mail {
	const locale: Locale = isLocale(to.locale) ? to.locale : 'en';
	const params = {
		name: to.firstName ?? to.name,
		event: pickLocalized(event.title as LocalizedText, locale),
		date: moment(event.startsAt, locale),
		until: holdUntil ? moment(holdUntil, locale) : '',
		url: `${siteUrl ?? ''}${localizePath(`/events/${event.slug}`, locale)}`
	};
	const text = holdUntil
		? 'registrations.mail.promoted.textPay'
		: 'registrations.mail.promoted.text';
	return {
		to: to.email,
		subject: translate(locale, 'registrations.mail.promoted.subject', params),
		text: translate(locale, text, params)
	};
}
