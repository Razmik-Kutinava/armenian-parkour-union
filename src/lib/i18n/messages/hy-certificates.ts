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
	'certificates.mail.issued.subject': 'Ձեր հավաստագիրը՝ {number}',
	'certificates.mail.issued.text':
		'Բարև, {name}։\n\nՁեզ տրվել է հավաստագիր՝ {title}, № {number}, {date}։ Շնորհավորում ենք։\n\nԱյն կարող է ստուգել ցանկացած մեկը այս հղումով՝ {verify}\n\nՁեր հավաստագրերը՝ {url}'
};
