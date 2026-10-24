/** Admin "Coaches and judges" (docs/05 section 9). Part of `en`. */
export const enStaffAdmin = {
	'staff.col.member': 'Member',
	'staff.col.kind': 'Kind',
	'staff.col.category': 'Category',
	'staff.col.license': 'License number',
	'staff.col.certificate': 'Certificate',
	'staff.col.public': 'Public',
	'staff.col.active': 'Active',
	'staff.flag.yes': 'Yes',
	'staff.flag.no': 'No',
	'staff.search': 'Member or license number',
	'staff.empty':
		'No coaches or judges yet: a profile appears when a coach or judge certificate is issued.',
	'staff.card.photo': 'Photo',
	'staff.card.photoHint': 'The member changes the photo in their account.',
	'staff.card.certificate': 'Valid certificate',
	'staff.card.until': 'until {date}',
	'staff.card.noCertificate': 'None.',
	'staff.form.title': 'Profile',
	'staff.form.category': 'Category',
	'staff.form.license': 'License number',
	'staff.form.bio': 'Description',
	'staff.form.bioHint':
		'Plain text for the "Coaches and judges" page. English is required when another language is filled.',
	'staff.form.public': 'Show publicly',
	'staff.form.active': 'Active',
	'staff.form.activeHint':
		'Switches on only with a valid certificate of this kind. A new certificate of this kind switches the profile on again.',
	'staff.saved': 'Saved.',
	'staff.error.bioEn': 'Fill in English first: it is shown when a language is empty.',
	'staff.refusal.no_live_certificate':
		'No valid certificate of this kind: the profile cannot be switched on.'
} as const;
