import type { Messages } from '../translate';

export const ruStaffAdmin: Partial<Messages> = {
	'staff.col.member': 'Участник',
	'staff.col.kind': 'Вид',
	'staff.col.category': 'Категория',
	'staff.col.license': 'Номер лицензии',
	'staff.col.certificate': 'Сертификат',
	'staff.col.public': 'Публичный',
	'staff.col.active': 'Активен',
	'staff.flag.yes': 'Да',
	'staff.flag.no': 'Нет',
	'staff.search': 'Участник или номер лицензии',
	'staff.empty':
		'Тренеров и судей пока нет: профиль появляется при выдаче сертификата тренера или судьи.',
	'staff.card.photo': 'Фото',
	'staff.card.photoHint': 'Фото участник меняет в своём кабинете.',
	'staff.card.certificate': 'Действующий сертификат',
	'staff.card.until': 'до {date}',
	'staff.card.noCertificate': 'Нет.',
	'staff.form.title': 'Профиль',
	'staff.form.category': 'Категория',
	'staff.form.license': 'Номер лицензии',
	'staff.form.bio': 'Описание',
	'staff.form.bioHint':
		'Обычный текст для страницы «Тренеры и судьи». Английский обязателен, если заполнен другой язык.',
	'staff.form.public': 'Показывать публично',
	'staff.form.active': 'Активен',
	'staff.form.activeHint':
		'Включается только при действующем сертификате этого вида. Новый сертификат этого вида снова включит профиль.',
	'staff.saved': 'Сохранено.',
	'staff.error.bioEn': 'Сначала заполните английский: он показывается, если язык пустой.',
	'staff.refusal.no_live_certificate':
		'Нет действующего сертификата этого вида: профиль нельзя включить.'
};
