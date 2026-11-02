import type { Messages } from '../translate';

/** Partner cashier pages: binding the phone. Part of `ru`. */
export const ruVolunteerCashier: Partial<Messages> = {
	'volunteerCashier.join.title': 'Телефон кассира',
	'volunteerCashier.join.text':
		'Этот телефон будет привязан к партнёру {partner} ({label}). После этого с него можно отмечать плюшки на страницах проверки книжки волонтёра.',
	'volunteerCashier.join.browser':
		'Откройте ссылку в том браузере, который открывает QR-коды с камеры (обычно это браузер телефона по умолчанию).',
	'volunteerCashier.join.bind': 'Привязать этот телефон',
	'volunteerCashier.join.invalid': 'Ссылка недействительна, попросите у федерации новую.',
	'volunteerCashier.partner.title': 'Кассир партнёра',
	'volunteerCashier.partner.bound': 'Телефон привязан: {partner}, {label}',
	'volunteerCashier.partner.hint':
		'Сканируйте QR книжки камерой телефона; страница должна открыться в этом браузере.',
	'volunteerCashier.partner.unbound': 'Телефон не привязан',
	'volunteerCashier.partner.unboundHint': 'Попросите у федерации ссылку-приглашение.',
	'volunteerCashier.check.banner': 'Вы — {partner}, {label}',
	'volunteerCashier.mark.remaining': 'Осталось использований на этой книжке: {count}',
	'volunteerCashier.mark.action': 'Отметить',
	'volunteerCashier.mark.confirm': 'Подтвердить отметку',
	'volunteerCashier.mark.cancel': 'Отмена',
	'volunteerCashier.mark.done': 'Отмечено в {time}',
	'volunteerCashier.mark.noAccess': 'На этом телефоне нет действующего доступа кассира.',
	'volunteerCashier.mark.invalidCard': 'Эта книжка волонтёра недействительна.',
	'volunteerCashier.mark.noUsesLeft': 'На этой книжке не осталось использований этой плюшки.',
	'volunteerCashier.mark.perkUnavailable': 'Эту плюшку нельзя отметить.'
};
