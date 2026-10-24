import type { Messages } from '../translate';

export const hyCertificates: Partial<Messages> = {
	'certificates.kind.level_advanced': '«Առաջադեմ» աստիճանի հավաստագիր',
	'certificates.kind.level_pro': '«Պրոֆի» աստիճանի հավաստագիր',
	'certificates.kind.trainer': 'Մարզչի հավաստագիր',
	'certificates.kind.judge': 'Մրցավարի հավաստագիր',
	'certificates.pdf.title': 'Հավաստագիր',
	'certificates.pdf.number': 'Համար',
	'certificates.pdf.issued': 'Տրման ամսաթիվ',
	'certificates.pdf.valid_until': 'Վավեր է մինչև',
	'certificates.pdf.category': 'Կարգ',
	'certificates.pdf.signature': 'Ստորագրություն',
	'certificates.pdf.verify': 'Ստուգել',
	'certificates.verify.title': 'Հավաստագրի ստուգում',
	'certificates.verify.holder': 'Սեփականատեր',
	'certificates.verify.kind': 'Հավաստագիր',
	'certificates.verify.state.active': 'Վավեր է',
	'certificates.verify.state.expired': 'Ժամկետանց է',
	'certificates.verify.state.revoked': 'Չեղարկված է',
	'certificates.mail.issued.subject': 'Ձեր հավաստագիրը՝ {number}',
	'certificates.mail.issued.text':
		'Բարև, {name}։\n\nՁեզ տրվել է հավաստագիր՝ {title}, № {number}, {date}։ Շնորհավորում ենք։\n\nԱյն կարող է ստուգել ցանկացած մեկը այս հղումով՝ {verify}\n\nՁեր հավաստագրերը՝ {url}'
};
