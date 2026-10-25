/** Cabinet "Orders" (docs/06 section 5.8); statuses and delivery labels — `shop.order.*`. Part of `en`. */
export const enCabinetOrders = {
	'cabinet.nav.orders': 'Orders',
	'cabinet.orders.title': 'My orders',
	'cabinet.orders.intro':
		'Souvenirs ordered for points. A new order can be cancelled until the federation confirms it.',
	'cabinet.orders.empty': 'No orders yet.',
	'cabinet.orders.toShop': 'Go to the shop',
	'cabinet.orders.comment': 'Comment',
	'cabinet.orders.cancel': 'Cancel order',
	'cabinet.orders.cancelHint': 'The order is new: you can cancel it, and the points come back.',
	'cabinet.orders.cancelled': 'Order cancelled: {points} points are back on your balance.',
	'cabinet.orders.cancelLate':
		'The order is already being processed and cannot be cancelled here. Contact the federation.'
} as const;
