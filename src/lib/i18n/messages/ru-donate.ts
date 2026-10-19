import type { Messages } from '../translate';

export const ruDonate: Partial<Messages> = {
	'donate.title': 'Поддержать федерацию',
	'donate.intro':
		'Ваше пожертвование помогает Союзу паркура Армении проводить события, готовить тренеров и строить площадки.',
	'donate.amount': 'Сумма ({currency})',
	'donate.range': 'От {min} до {max}',
	'donate.quick': 'Быстрый выбор суммы',
	'donate.purpose': 'Назначение',
	'donate.purpose.general': 'Общие нужды федерации',
	'donate.name': 'Ваше имя',
	'donate.anonymous': 'Не показывать моё имя публично',
	'donate.from': 'Пожертвование от {name} ({email})',
	'donate.submit': 'Пожертвовать',
	'donate.notSet': 'Пожертвования скоро откроются.',
	'donate.recent': 'Последние пожертвования',
	'donate.anonymousDonor': 'Аноним',
	'donate.error.amount': 'Введите сумму целым числом.',
	'donate.error.range': 'Введите сумму от {min} до {max}.',
	'donate.error.purpose': 'Выберите назначение из списка.',
	'donate.error.invalid': 'Проверьте форму: выбранное назначение могло стать недоступным.',
	'donate.error.unavailable': 'Онлайн-оплата сейчас недоступна. Попробуйте позже.',
	'donate.error.providerError': 'Не удалось начать оплату. Попробуйте снова.',
	'donate.payment.description': 'Пожертвование Союзу паркура Армении',
	'donate.mail.subject': 'Спасибо за пожертвование',
	'donate.mail.text':
		'Здравствуйте, {name}!\n\nСпасибо, что поддерживаете Союз паркура Армении.\n\nСумма: {amount}\nДата: {date}\nНазначение: {purpose}\nНомер платежа: {payment}',
	'donate.mail.generalPurpose': 'общие нужды федерации',
	'donate.mail.requisites': 'Реквизиты федерации:'
};
