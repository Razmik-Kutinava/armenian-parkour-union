/** Membership fee: payment and letters (docs/07 sections 5.1, 12; docs/03 section 2). Part of `en`. */
export const enMembership = {
	'membership.payment.description': 'Armenian Parkour Union membership fee',
	'membership.mail.paid.subject': 'Membership fee received',
	'membership.mail.paid.text':
		'Hello, {name}!\n\nWe have received your membership fee. Thank you!\n\nAmount: {amount}\nDate: {date}\nPurpose: membership fee, {from} – {to}\nPayment number: {payment}\n\nYour membership: {url}',
	'membership.mail.requisites': 'Federation details:',
	'membership.mail.reminder.subject': 'Your membership ends on {date}',
	'membership.mail.reminder.text':
		'Hello, {name}!\n\nYour membership in the federation ends on {date}. Renew it to keep registering for events and taking exams: {url}'
} as const;
