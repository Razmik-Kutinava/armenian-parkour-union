/** Payment return pages /payment/success and /payment/cancel (docs/07 section 3 p. 7). Part of `en`. */
export const enPayment = {
	'payment.kind.membership': 'Membership fee',
	'payment.kind.donation': 'Donation',
	'payment.kind.event_fee': 'Event fee',
	'payment.amount': '{kind}: {amount}',
	'payment.paid.title': 'Payment received',
	'payment.paid.membership': 'Thank you! Your membership in the federation is active.',
	'payment.paid.donation':
		'Thank you for supporting the federation! We have sent a receipt to your email.',
	'payment.paid.event_fee': 'Thank you! Your payment has been received.',
	'payment.checking.title': 'Checking the payment…',
	'payment.checking.text': 'This usually takes a few seconds. Please keep this page open.',
	'payment.processing.title': 'The payment is being processed',
	'payment.processing.text':
		'The bank has not confirmed it yet. We will send you an email as soon as it does.',
	'payment.notCompleted.title': 'The payment was not completed',
	'payment.notCompleted.text':
		'If the money was charged anyway, we will confirm the payment automatically and send you an email.',
	'payment.failed.title': 'The payment did not go through',
	'payment.failed.text': 'The bank did not confirm the payment. You can try again.',
	'payment.cancelled.title': 'The payment was cancelled',
	'payment.cancelled.text': 'You can try again whenever you like.',
	'payment.refunded.title': 'The payment was refunded',
	'payment.refunded.text': 'The money for this payment has been returned.',
	'payment.retry': 'Try again',
	'payment.toMembership': 'My membership',
	'payment.toHome': 'Go to the home page',
	'payment.refresh': 'Refresh the page',
	'payment.mail.refund.subject': 'Your payment has been refunded',
	'payment.mail.refund.text':
		'Hello, {name}!\n\nWe have refunded your payment to the Armenian Parkour Union.\n\nAmount: {amount}\nPayment number: {payment}\n\nWhen the money reaches your account depends on your bank, usually a few working days.'
} as const;
