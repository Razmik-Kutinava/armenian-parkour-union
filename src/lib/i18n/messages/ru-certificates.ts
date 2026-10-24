import type { Messages } from '../translate';

export const ruCertificates: Partial<Messages> = {
	'certificates.kind.level_advanced': 'Сертификат степени «Продвинутый»',
	'certificates.kind.level_pro': 'Сертификат степени «Профи»',
	'certificates.kind.trainer': 'Сертификат тренера',
	'certificates.kind.judge': 'Сертификат судьи',
	'certificates.pdf.title': 'Сертификат',
	'certificates.pdf.number': 'Номер',
	'certificates.pdf.issued': 'Дата выдачи',
	'certificates.pdf.valid_until': 'Действителен до',
	'certificates.pdf.category': 'Категория',
	'certificates.pdf.signature': 'Подпись',
	'certificates.pdf.verify': 'Проверить',
	'certificates.verify.title': 'Проверка сертификата',
	'certificates.verify.holder': 'Владелец',
	'certificates.verify.kind': 'Сертификат',
	'certificates.verify.state.active': 'Действителен',
	'certificates.verify.state.expired': 'Истёк',
	'certificates.verify.state.revoked': 'Отозван',
	'certificates.mail.issued.subject': 'Ваш сертификат {number}',
	'certificates.mail.issued.text':
		'Здравствуйте, {name}!\n\nВам выдан сертификат: {title}, № {number} от {date}. Поздравляем!\n\nПроверить его может любой по ссылке: {verify}\n\nВаши сертификаты: {url}',
	'certificates.mail.expiring.subject': 'Срок сертификата {number} истекает {date}',
	'certificates.mail.expiring.text':
		'Здравствуйте, {name}!\n\nВаш сертификат {title}, № {number}, действует до {date}. Чтобы продлить его, свяжитесь с федерацией насчёт переаттестации.\n\nВаши сертификаты: {url}'
};
