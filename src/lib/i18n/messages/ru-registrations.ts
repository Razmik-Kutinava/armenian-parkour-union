import type { Messages } from '../translate';

/** Регистрации на события: блок на странице события, письма, оплата участия. Часть `ru`. */
export const ruRegistrations: Partial<Messages> = {
	'registrations.title': 'Регистрация',
	'registrations.guest': 'Войдите, чтобы зарегистрироваться',
	'registrations.opensAt': 'Регистрация откроется {date}.',
	'registrations.refused.not_open': 'Регистрация ещё не открылась.',
	'registrations.refused.closed': 'Регистрация закрыта.',
	'registrations.refused.blocked': 'Ваш аккаунт заблокирован: регистрация недоступна.',
	'registrations.refused.email_unverified': 'Подтвердите email, чтобы зарегистрироваться.',
	'registrations.refused.no_membership': 'Для участия нужно членство.',
	'registrations.refused.birth_date_required':
		'Укажите дату рождения в профиле, чтобы зарегистрироваться.',
	'registrations.refused.parental_consent':
		'Участникам младше 18 лет нужно одобренное согласие родителя.',
	'registrations.refused.age_mismatch': 'Ваш возраст не подходит ни под одну категорию события.',
	'registrations.refused.payment_unavailable':
		'Онлайн-оплата сейчас недоступна, поэтому регистрация на платные события закрыта.',
	'registrations.refused.category_required': 'Выберите категорию.',
	'registrations.refused.category_invalid': 'Эта категория вам недоступна.',
	'registrations.refused.already_registered': 'Вы уже зарегистрированы на это событие.',
	'registrations.refused.not_found': 'Событие недоступно.',
	'registrations.link.join': 'Вступить в федерацию',
	'registrations.link.documents': 'Загрузить согласие',
	'registrations.link.profile': 'Открыть профиль',
	'registrations.link.cabinet': 'Открыть кабинет',
	'registrations.category': 'Категория',
	'registrations.categoryFull': '{name} — мест нет, очередь',
	'registrations.full':
		'Мест нет. Встаньте в очередь: когда место освободится, его получит первый в очереди.',
	'registrations.paidNote':
		'Участие платное: после регистрации место удерживается за вами на ограниченное время для оплаты.',
	'registrations.submit': 'Зарегистрироваться',
	'registrations.submitWaitlist': 'Встать в очередь',
	'registrations.registered': 'Вы зарегистрированы.',
	'registrations.attended': 'Вы участвовали в этом событии.',
	'registrations.waitlist': 'Вы в очереди. Когда место освободится, мы напишем вам на почту.',
	'registrations.held':
		'Место удерживается за вами до {time}. Оплатите, чтобы подтвердить регистрацию.',
	'registrations.heldLeft': 'Осталось {minutes} мин',
	'registrations.expired': 'Время на оплату истекло: место переходит следующему в очереди.',
	'registrations.pay': 'Оплатить участие',
	'registrations.cancelUntil': 'Отменить можно до {date}.',
	'registrations.cancelLate': 'Отменить регистрацию уже нельзя.',
	'registrations.cancel': 'Отменить регистрацию',
	'registrations.leaveWaitlist': 'Выйти из очереди',
	'registrations.cancelled': 'Регистрация отменена.',
	'registrations.changed': 'Регистрация изменилась. Обновите страницу.',
	'registrations.payError.unavailable': 'Онлайн-оплата сейчас недоступна.',
	'registrations.payError.provider_error':
		'Платёжный сервис не ответил. Попробуйте ещё раз через несколько минут.',
	'registrations.payError.hold_expired': 'Время на оплату истекло.',
	'registrations.payError.closed': 'Регистрация на это событие закрыта.',
	'registrations.payment.description': 'Участие: {event}',
	'registrations.mail.promoted.subject': 'Освободилось место: {event}',
	'registrations.mail.promoted.text':
		'Здравствуйте, {name}!\n\nНа событии «{event}» ({date}) освободилось место — вы зарегистрированы.\n\nСтраница события: {url}',
	'registrations.mail.promoted.textPay':
		'Здравствуйте, {name}!\n\nНа событии «{event}» ({date}) освободилось место. Оплатите участие до {until}, чтобы сохранить его; после этого место перейдёт следующему в очереди.\n\nСтраница события: {url}'
};
