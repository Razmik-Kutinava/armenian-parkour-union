import { translate } from '#lib/i18n/translate.ts';
import type { Mail } from '../../mail/resend';
import { eventLetter, OWN_EVENTS, type EventRef, type RegistrationRecipient } from './mail';

/* Owner's answer 2026-10-26 (questions.md, stage 5): letters on a registration ended not by the
 * member — beyond the list of docs/03 section 14. */

/** Staff cancelled it; their reason is an internal note and stays out of the letter. */
export function staffCancelledLetter(
	to: RegistrationRecipient,
	event: EventRef,
	paid: boolean,
	siteUrl: string | undefined
): Mail {
	return eventLetter(
		to,
		event,
		{
			subject: 'registrations.mail.staffCancelled.subject',
			text: 'registrations.mail.staffCancelled.text'
		},
		{ path: OWN_EVENTS, siteUrl },
		(locale) => ({
			refund: paid ? `\n\n${translate(locale, 'registrations.mail.eventCancelled.refund')}` : ''
		})
	);
}

/** docs/03 section 7.4: the hold ran out unpaid; the event page — to register again if there is room. */
export function holdExpiredLetter(
	to: RegistrationRecipient,
	event: EventRef,
	siteUrl: string | undefined
): Mail {
	return eventLetter(
		to,
		event,
		{
			subject: 'registrations.mail.holdExpired.subject',
			text: 'registrations.mail.holdExpired.text'
		},
		{ path: `/events/${event.slug}`, siteUrl }
	);
}
