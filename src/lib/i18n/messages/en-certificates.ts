/** Certificates: names, PDF labels and the "issued" letter (docs/03 sections 4, 14). Part of `en`. */
export const enCertificates = {
	'certificates.kind.level_advanced': 'Level certificate "Advanced"',
	'certificates.kind.level_pro': 'Level certificate "Pro"',
	'certificates.kind.trainer': 'Coach certificate',
	'certificates.kind.judge': 'Judge certificate',
	'certificates.pdf.title': 'Certificate',
	'certificates.pdf.number': 'Number',
	'certificates.pdf.issued': 'Date of issue',
	'certificates.pdf.valid_until': 'Valid until',
	'certificates.pdf.category': 'Category',
	'certificates.pdf.signature': 'Signature',
	'certificates.pdf.verify': 'Verify',
	'certificates.verify.title': 'Certificate check',
	'certificates.verify.holder': 'Holder',
	'certificates.verify.kind': 'Certificate',
	'certificates.verify.state.active': 'Valid',
	'certificates.verify.state.expired': 'Expired',
	'certificates.verify.state.revoked': 'Revoked',
	'certificates.mail.issued.subject': 'Your certificate {number}',
	'certificates.mail.issued.text':
		'Hello, {name}!\n\nYou have been issued a certificate: {title}, No. {number} of {date}. Congratulations!\n\nAnyone can check it by this link: {verify}\n\nYour certificates: {url}',
	'certificates.mail.expiring.subject': 'Your certificate {number} expires on {date}',
	'certificates.mail.expiring.text':
		'Hello, {name}!\n\nYour certificate {title}, No. {number}, is valid until {date}. To renew it, contact the federation about re-certification.\n\nYour certificates: {url}'
} as const;
