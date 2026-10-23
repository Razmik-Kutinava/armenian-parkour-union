/** Event registrations: letters (docs/03 section 7.3, 14), the fee payment. Part of `en`. */
export const enRegistrations = {
	'registrations.payment.description': 'Participation: {event}',
	'registrations.mail.promoted.subject': 'A place has opened: {event}',
	'registrations.mail.promoted.text':
		'Hello, {name}!\n\nA place has opened at “{event}” ({date}), and you are now registered.\n\nEvent page: {url}',
	'registrations.mail.promoted.textPay':
		'Hello, {name}!\n\nA place has opened at “{event}” ({date}). Pay the participation fee by {until} to keep it; after that the place goes to the next person in line.\n\nEvent page: {url}'
} as const;
