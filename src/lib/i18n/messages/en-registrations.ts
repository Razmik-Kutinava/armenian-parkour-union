/**
 * Event registrations: the block on the event page (docs/06 section 4.3), letters (docs/03
 * section 7.3, 14), the fee payment. Part of `en`.
 */
export const enRegistrations = {
	'registrations.title': 'Registration',
	'registrations.guest': 'Log in to register',
	'registrations.opensAt': 'Registration opens {date}.',
	'registrations.refused.not_open': 'Registration has not opened yet.',
	'registrations.refused.closed': 'Registration is closed.',
	'registrations.refused.blocked': 'Your account is blocked: registration is not available.',
	'registrations.refused.email_unverified': 'Confirm your email to register.',
	'registrations.refused.no_membership': 'Participation requires a membership.',
	'registrations.refused.birth_date_required': 'Add your date of birth to the profile to register.',
	'registrations.refused.parental_consent':
		'Participants under 18 need an approved parental consent.',
	'registrations.refused.age_mismatch': 'Your age does not fit any category of this event.',
	'registrations.refused.payment_unavailable':
		'Online payment is not available right now, so registration for paid events is closed.',
	'registrations.refused.category_required': 'Choose a category.',
	'registrations.refused.category_invalid': 'This category is not available to you.',
	'registrations.refused.already_registered': 'You are already registered for this event.',
	'registrations.refused.not_found': 'This event is not available.',
	'registrations.link.join': 'Become a member',
	'registrations.link.documents': 'Upload the consent',
	'registrations.link.profile': 'Open the profile',
	'registrations.link.cabinet': 'Open the cabinet',
	'registrations.category': 'Category',
	'registrations.categoryFull': '{name} — no places, waitlist',
	'registrations.full':
		'No places left. Join the waitlist: when a place frees up, the first in line gets it.',
	'registrations.paidNote':
		'Participation is paid: after registering, the place is held for you for a limited time to pay.',
	'registrations.submit': 'Register',
	'registrations.submitWaitlist': 'Join the waitlist',
	'registrations.registered': 'You are registered.',
	'registrations.attended': 'You took part in this event.',
	'registrations.waitlist': 'You are on the waitlist. When a place frees up, we will email you.',
	'registrations.held': 'Your place is held until {time}. Pay to confirm the registration.',
	'registrations.heldLeft': '{minutes} min left',
	'registrations.expired': 'The time to pay has run out: the place goes to the next in line.',
	'registrations.pay': 'Pay for participation',
	'registrations.cancelUntil': 'You can cancel until {date}.',
	'registrations.cancelLate': 'It is too late to cancel the registration.',
	'registrations.cancel': 'Cancel registration',
	'registrations.leaveWaitlist': 'Leave the waitlist',
	'registrations.cancelled': 'Registration cancelled.',
	'registrations.changed': 'The registration has changed. Refresh the page.',
	'registrations.payError.unavailable': 'Online payment is not available right now.',
	'registrations.payError.provider_error':
		'The payment service did not answer. Try again in a few minutes.',
	'registrations.payError.hold_expired': 'The time to pay has run out.',
	'registrations.payError.closed': 'Registration for this event is closed.',
	'registrations.payment.description': 'Participation: {event}',
	'registrations.points.cancelled': 'Registration for “{event}” cancelled before the start',
	'registrations.mail.promoted.subject': 'A place has opened: {event}',
	'registrations.mail.promoted.text':
		'Hello, {name}!\n\nA place has opened at “{event}” ({date}), and you are now registered.\n\nEvent page: {url}',
	'registrations.mail.promoted.textPay':
		'Hello, {name}!\n\nA place has opened at “{event}” ({date}). Pay the participation fee by {until} to keep it; after that the place goes to the next person in line.\n\nEvent page: {url}'
} as const;
