import type { Messages } from '../translate';

/** Регистрации на события: письма. Часть `ru`. */
export const ruRegistrations: Partial<Messages> = {
	'registrations.mail.promoted.subject': 'Освободилось место: {event}',
	'registrations.mail.promoted.text':
		'Здравствуйте, {name}!\n\nНа событии «{event}» ({date}) освободилось место — вы зарегистрированы.\n\nСтраница события: {url}',
	'registrations.mail.promoted.textPay':
		'Здравствуйте, {name}!\n\nНа событии «{event}» ({date}) освободилось место. Оплатите участие до {until}, чтобы сохранить его; после этого место перейдёт следующему в очереди.\n\nСтраница события: {url}'
};
