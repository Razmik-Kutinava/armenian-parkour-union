import { pickLocalized, type LocalizedText } from '#lib/i18n/localized.ts';
import { isLocale, localizePath, type Locale } from '#lib/i18n/locales.ts';
import { translate, type MessageKey, type MessageParams } from '#lib/i18n/translate.ts';
import type { Mail } from '../../mail/resend';

export type RegistrationRecipient = {
	email: string;
	locale: string;
	firstName: string | null;
	name: string;
};

/** Without them a service changes the data and sends nothing. */
export type LetterDeps = { send: (mail: Mail) => Promise<void>; siteUrl: string | undefined };

export type EventRef = { slug: string; title: unknown; startsAt: Date };

export const moment = (date: Date, locale: Locale) =>
	date.toLocaleString(locale, { dateStyle: 'long', timeStyle: 'short', timeZone: 'Asia/Yerevan' });

export const languageOf = (to: RegistrationRecipient): Locale =>
	isLocale(to.locale) ? to.locale : 'en';

/** A letter in the member's language: {name}, {event}, {date} and {url} are always there. */
export function eventLetter(
	to: RegistrationRecipient,
	event: EventRef,
	keys: { subject: MessageKey; text: MessageKey },
	link: { path: string; siteUrl: string | undefined },
	extra: (locale: Locale) => MessageParams = () => ({})
): Mail {
	const locale = languageOf(to);
	const params = {
		name: to.firstName ?? to.name,
		event: pickLocalized(event.title as LocalizedText, locale),
		date: moment(event.startsAt, locale),
		url: `${link.siteUrl ?? ''}${localizePath(link.path, locale)}`,
		...extra(locale)
	};
	return {
		to: to.email,
		subject: translate(locale, keys.subject, params),
		text: translate(locale, keys.text, params)
	};
}

export const OWN_EVENTS = '/cabinet/events';

/** docs/03 section 7.3, 14: "a seat is yours"; a paid event — pay before `holdUntil`. */
export function promotedLetter(
	to: RegistrationRecipient,
	event: EventRef,
	holdUntil: Date | null,
	siteUrl: string | undefined
): Mail {
	const text = holdUntil
		? 'registrations.mail.promoted.textPay'
		: 'registrations.mail.promoted.text';
	return eventLetter(
		to,
		event,
		{ subject: 'registrations.mail.promoted.subject', text },
		{ path: `/events/${event.slug}`, siteUrl },
		(locale) => ({ until: holdUntil ? moment(holdUntil, locale) : '' })
	);
}

/** docs/03 section 14: a registration on the site — registered, or in line for a seat. */
export function registeredLetter(
	to: RegistrationRecipient,
	event: EventRef,
	status: 'registered' | 'waitlist',
	siteUrl: string | undefined
): Mail {
	const kind = status === 'registered' ? 'confirmed' : 'waitlist';
	return eventLetter(
		to,
		event,
		{ subject: `registrations.mail.${kind}.subject`, text: `registrations.mail.${kind}.text` },
		{ path: OWN_EVENTS, siteUrl }
	);
}

/** docs/03 section 7 p. 8: the event is cancelled; a paid seat — the admin will see to the refund. */
export function eventCancelledLetter(
	to: RegistrationRecipient,
	event: EventRef,
	paid: boolean,
	siteUrl: string | undefined
): Mail {
	return eventLetter(
		to,
		event,
		{
			subject: 'registrations.mail.eventCancelled.subject',
			text: 'registrations.mail.eventCancelled.text'
		},
		{ path: OWN_EVENTS, siteUrl },
		(locale) => ({
			refund: paid ? `\n\n${translate(locale, 'registrations.mail.eventCancelled.refund')}` : ''
		})
	);
}
