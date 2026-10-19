/** Donations: the /donate page and the thank-you letter (docs/06 section 4.8, docs/07 section 5.2). Part of `en`. */
export const enDonate = {
	'donate.title': 'Support the federation',
	'donate.intro':
		'Your donation helps the Armenian Parkour Union run events, train coaches and build places to practise.',
	'donate.amount': 'Amount ({currency})',
	'donate.range': 'From {min} to {max}',
	'donate.quick': 'Quick amounts',
	'donate.purpose': 'Purpose',
	'donate.purpose.general': 'General needs of the federation',
	'donate.name': 'Your name',
	'donate.anonymous': 'Do not show my name publicly',
	'donate.from': 'Donation from {name} ({email})',
	'donate.submit': 'Donate',
	'donate.notSet': 'Donations will open soon.',
	'donate.recent': 'Recent donations',
	'donate.anonymousDonor': 'Anonymous',
	'donate.error.amount': 'Enter the amount as a whole number.',
	'donate.error.range': 'Enter an amount from {min} to {max}.',
	'donate.error.purpose': 'Choose a purpose from the list.',
	'donate.error.invalid': 'Check the form: the chosen purpose may no longer be available.',
	'donate.error.unavailable': 'Online payment is not available right now. Please try again later.',
	'donate.error.providerError': 'The payment could not be started. Please try again.',
	'donate.payment.description': 'Donation to the Armenian Parkour Union',
	'donate.mail.subject': 'Thank you for your donation',
	'donate.mail.text':
		'Hello, {name}!\n\nThank you for supporting the Armenian Parkour Union.\n\nAmount: {amount}\nDate: {date}\nPurpose: {purpose}\nPayment number: {payment}',
	'donate.mail.generalPurpose': 'general needs of the federation',
	'donate.mail.requisites': 'Federation details:'
} as const;
