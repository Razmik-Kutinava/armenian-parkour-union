/** Partner cashier pages: binding the phone (docs/06 section 4.13). Part of `en`. */
export const enVolunteerCashier = {
	'volunteerCashier.join.title': 'Cashier phone',
	'volunteerCashier.join.text':
		'This phone will be bound to the partner {partner} ({label}). Then it can mark perks on volunteer card check pages.',
	'volunteerCashier.join.browser':
		'Open this link in the browser that opens QR codes from the camera (usually the default browser of the phone).',
	'volunteerCashier.join.bind': 'Bind this phone',
	'volunteerCashier.join.invalid': 'The link is not valid. Ask the federation for a new one.',
	'volunteerCashier.partner.title': 'Partner cashier',
	'volunteerCashier.partner.bound': 'The phone is bound: {partner}, {label}',
	'volunteerCashier.partner.hint':
		'Scan the QR code of a volunteer card with the phone camera; the page must open in this browser.',
	'volunteerCashier.partner.unbound': 'The phone is not bound',
	'volunteerCashier.partner.unboundHint': 'Ask the federation for an invite link.',
	'volunteerCashier.check.banner': 'You are {partner}, {label}',
	'volunteerCashier.mark.remaining': 'Uses left on this card: {count}',
	'volunteerCashier.mark.action': 'Mark',
	'volunteerCashier.mark.confirm': 'Confirm mark',
	'volunteerCashier.mark.cancel': 'Cancel',
	'volunteerCashier.mark.done': 'Marked at {time}',
	'volunteerCashier.mark.noAccess': 'Cashier access is not active on this phone.',
	'volunteerCashier.mark.invalidCard': 'This volunteer card is not valid.',
	'volunteerCashier.mark.noUsesLeft': 'No uses left for this perk on this card.',
	'volunteerCashier.mark.perkUnavailable': 'This perk cannot be marked.'
} as const;
