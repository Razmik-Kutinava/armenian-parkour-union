/** Certificates: names and the "issued" letter (docs/03 sections 4, 14). Part of `en`. */
export const enCertificates = {
	'certificates.kind.level_advanced': 'Level certificate "Advanced"',
	'certificates.kind.level_pro': 'Level certificate "Pro"',
	'certificates.kind.trainer': 'Coach certificate',
	'certificates.kind.judge': 'Judge certificate',
	'certificates.mail.issued.subject': 'Your certificate {number}',
	'certificates.mail.issued.text':
		'Hello, {name}!\n\nYou have been issued a certificate: {title}, No. {number} of {date}. Congratulations!\n\nAnyone can check it by this link: {verify}\n\nYour certificates: {url}'
} as const;
