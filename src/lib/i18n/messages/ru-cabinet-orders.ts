import type { Messages } from '../translate';

export const ruCabinetOrders: Partial<Messages> = {
	'cabinet.nav.orders': 'Заказы',
	'cabinet.orders.title': 'Мои заказы',
	'cabinet.orders.intro':
		'Сувениры, заказанные за баллы. Новый заказ можно отменить, пока федерация его не подтвердила.',
	'cabinet.orders.empty': 'Заказов пока нет.',
	'cabinet.orders.toShop': 'В магазин',
	'cabinet.orders.comment': 'Комментарий',
	'cabinet.orders.cancel': 'Отменить заказ',
	'cabinet.orders.cancelHint': 'Заказ новый: его можно отменить, баллы вернутся.',
	'cabinet.orders.cancelled': 'Заказ отменён: {points} баллов вернулись на баланс.',
	'cabinet.orders.cancelLate':
		'Заказ уже в работе, отменить его здесь нельзя. Свяжитесь с федерацией.'
};
