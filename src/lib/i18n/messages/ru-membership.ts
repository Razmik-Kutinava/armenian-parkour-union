import type { Messages } from '../translate';

export const ruMembership: Partial<Messages> = {
	'membership.payment.description': 'Членский взнос Союза паркура Армении',
	'membership.mail.paid.subject': 'Членский взнос получен',
	'membership.mail.paid.text':
		'Здравствуйте, {name}!\n\nМы получили ваш членский взнос. Спасибо!\n\nСумма: {amount}\nДата: {date}\nНазначение: членский взнос, {from} – {to}\nНомер платежа: {payment}\n\nВаше членство: {url}',
	'membership.mail.requisites': 'Реквизиты федерации:',
	'membership.mail.reminder.subject': 'Ваше членство заканчивается {date}',
	'membership.mail.reminder.text':
		'Здравствуйте, {name}!\n\nВаше членство в федерации заканчивается {date}. Продлите его, чтобы и дальше регистрироваться на события и сдавать экзамены: {url}',
	'membership.fee.title': 'Членский взнос',
	'membership.fee.amount': '{amount} на {months} мес.',
	'membership.fee.notSet': 'Размер взноса скоро появится.',
	'membership.pay.submit': 'Оплатить взнос',
	'membership.pay.renew': 'Продлить членство',
	'membership.pay.emailUnverified':
		'Сначала подтвердите email: откройте ссылку из письма, которое пришло при регистрации.',
	'membership.pay.unavailable': 'Онлайн-оплата сейчас недоступна. Попробуйте позже.',
	'membership.pay.providerError': 'Не удалось начать оплату. Попробуйте снова.',
	'join.title': 'Вступить в федерацию',
	'join.signUp': 'Зарегистрироваться',
	'join.logIn': 'Войти',
	'join.member': 'Вы уже в федерации.',
	'join.cabinet': 'Моё членство',
	'cabinet.membership.title': 'Членство',
	'cabinet.membership.activeUntil': 'Действует до {date}',
	'cabinet.membership.none': 'Нет действующего членства',
	'cabinet.membership.waiting': 'Ожидаем подтверждение платежа',
	'cabinet.membership.history': 'История',
	'cabinet.membership.period': '{from} – {to}',
	'cabinet.membership.status.active': 'Действует',
	'cabinet.membership.status.expired': 'Истекло',
	'cabinet.membership.status.cancelled': 'Отменено',
	'cabinet.membership.status.pending': 'Ожидает оплаты'
};
