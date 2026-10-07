/** Admin "Audit log" and "Site settings" (docs/05 sections 21 and 22). Part of `en`. */
export const enSystem = {
	'audit.col.date': 'Date',
	'audit.col.actor': 'Who',
	'audit.col.action': 'Action',
	'audit.col.entity': 'Object',
	'audit.col.details': 'Details',
	'audit.filter.from': 'From',
	'audit.filter.to': 'To',
	'audit.search': 'Author: name or email',
	'audit.export': 'Export CSV',
	'audit.open': 'Open',

	'settings.main': 'Main',
	'settings.siteName': 'Federation name',
	'settings.seo': 'Description for search engines',
	'settings.address': 'Address',
	'settings.mapUrl': 'Map link',
	'settings.httpsHint': 'Full links starting with https://. Leave empty to hide.',
	'settings.footer': 'Footer',
	'settings.footerText': 'Footer text',
	'settings.fixErrors': 'Nothing was saved. Fix the marked fields.',
	'settings.error.url': 'Enter a link starting with https://'
} as const;
