import type { Messages } from '../translate';

export const ruMembership: Partial<Messages> = {
	'membership.payment.description': 'Членский взнос Союза паркура Армении',
	'membership.mail.paid.subject': 'Членский взнос получен',
	'membership.mail.paid.text':
		'Здравствуйте, {name}!\n\nМы получили ваш членский взнос. Спасибо!\n\nСумма: {amount}\nДата: {date}\nНазначение: членский взнос, {from} – {to}\nНомер платежа: {payment}\n\nВаше членство: {url}',
	'membership.mail.requisites': 'Реквизиты федерации:',
	'membership.mail.reminder.subject': 'Ваше членство заканчивается {date}',
	'membership.mail.reminder.text':
		'Здравствуйте, {name}!\n\nВаше членство в федерации заканчивается {date}. Продлите его, чтобы и дальше регистрироваться на события и сдавать экзамены: {url}'
};
