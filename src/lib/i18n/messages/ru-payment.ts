import type { Messages } from '../translate';

export const ruPayment: Partial<Messages> = {
	'payment.kind.membership': 'Членский взнос',
	'payment.kind.donation': 'Пожертвование',
	'payment.kind.event_fee': 'Участие в событии',
	'payment.amount': '{kind}: {amount}',
	'payment.paid.title': 'Оплата получена',
	'payment.paid.membership': 'Спасибо! Ваше членство в федерации активно.',
	'payment.paid.donation':
		'Спасибо, что поддерживаете федерацию! Квитанция отправлена на вашу почту.',
	'payment.paid.event_fee': 'Спасибо! Оплата получена.',
	'payment.checking.title': 'Проверяем платёж…',
	'payment.checking.text': 'Обычно это занимает несколько секунд. Не закрывайте страницу.',
	'payment.processing.title': 'Платёж обрабатывается',
	'payment.processing.text':
		'Банк ещё не подтвердил оплату. Мы отправим письмо, как только это произойдёт.',
	'payment.notCompleted.title': 'Оплата не завершена',
	'payment.notCompleted.text':
		'Если деньги всё же списались, мы подтвердим платёж автоматически и отправим письмо.',
	'payment.failed.title': 'Оплата не прошла',
	'payment.failed.text': 'Банк не подтвердил платёж. Можно попробовать ещё раз.',
	'payment.cancelled.title': 'Оплата отменена',
	'payment.cancelled.text': 'Можно попробовать ещё раз в любое время.',
	'payment.refunded.title': 'Платёж возвращён',
	'payment.refunded.text': 'Деньги за этот платёж возвращены.',
	'payment.retry': 'Попробовать снова',
	'payment.toMembership': 'Моё членство',
	'payment.toHome': 'На главную',
	'payment.refresh': 'Обновить страницу'
};
