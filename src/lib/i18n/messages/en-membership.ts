/** Membership fee: payment and letters (docs/07 sections 5.1, 12; docs/03 section 2). Part of `en`. */
export const enMembership = {
	'membership.payment.description': 'Armenian Parkour Union membership fee',
	'membership.mail.paid.subject': 'Membership fee received',
	'membership.mail.paid.text':
		'Hello, {name}!\n\nWe have received your membership fee. Thank you!\n\nAmount: {amount}\nDate: {date}\nPurpose: membership fee, {from} – {to}\nPayment number: {payment}\n\nYour membership: {url}',
	'membership.mail.requisites': 'Federation details:',
	'membership.mail.reminder.subject': 'Your membership ends on {date}',
	'membership.mail.reminder.text':
		'Hello, {name}!\n\nYour membership in the federation ends on {date}. Renew it to keep registering for events and taking exams: {url}',
	'membership.fee.title': 'Membership fee',
	'membership.fee.amount': '{amount} for {months} months',
	'membership.fee.notSet': 'The fee amount will be announced soon.',
	'membership.pay.submit': 'Pay the fee',
	'membership.pay.renew': 'Renew membership',
	'membership.pay.emailUnverified':
		'Confirm your email first: open the link from the letter we sent when you signed up.',
	'membership.pay.unavailable':
		'Online payment is not available right now. Please try again later.',
	'membership.pay.providerError': 'The payment could not be started. Please try again.',
	'join.title': 'Join the federation',
	'join.signUp': 'Create an account',
	'join.logIn': 'Log in',
	'join.member': 'You are already a member of the federation.',
	'join.cabinet': 'My membership',
	'cabinet.membership.title': 'Membership',
	'cabinet.membership.activeUntil': 'Active until {date}',
	'cabinet.membership.none': 'No active membership',
	'cabinet.membership.waiting': 'Awaiting payment confirmation',
	'cabinet.membership.history': 'History',
	'cabinet.membership.period': '{from} – {to}',
	'cabinet.membership.status.active': 'Active',
	'cabinet.membership.status.expired': 'Expired',
	'cabinet.membership.status.cancelled': 'Cancelled',
	'cabinet.membership.status.pending': 'Awaiting payment'
} as const;
