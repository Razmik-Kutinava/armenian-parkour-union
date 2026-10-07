import type { enSystem } from './en-system';

/** Админка «Журнал действий» и «Настройки сайта». Часть `ru`. */
export const ruSystem: Record<keyof typeof enSystem, string> = {
	'audit.col.date': 'Дата',
	'audit.col.actor': 'Кто',
	'audit.col.action': 'Действие',
	'audit.col.entity': 'Объект',
	'audit.col.details': 'Подробно',
	'audit.filter.from': 'С',
	'audit.filter.to': 'По',
	'audit.search': 'Автор: имя или email',
	'audit.export': 'Экспорт CSV',
	'audit.open': 'Открыть',

	'settings.main': 'Основное',
	'settings.siteName': 'Название федерации',
	'settings.seo': 'Описание для поисковиков',
	'settings.address': 'Адрес',
	'settings.mapUrl': 'Ссылка на карту',
	'settings.httpsHint': 'Полные ссылки, начиная с https://. Пустое поле — не показывать.',
	'settings.footer': 'Подвал',
	'settings.footerText': 'Текст подвала',
	'settings.fixErrors': 'Ничего не сохранено. Исправьте отмеченные поля.',
	'settings.error.url': 'Введите ссылку, начиная с https://'
};
