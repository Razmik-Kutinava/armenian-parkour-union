import type { enPages } from './en-pages';

/** Админка «Страницы» и публичная страница. Часть `ru`. */
export const ruPages: Record<keyof typeof enPages, string> = {
	'pages.create': 'Новая страница',
	'pages.empty': 'Страниц пока нет',
	'pages.back': 'Все страницы',
	'pages.col.title': 'Название',
	'pages.col.slug': 'Адрес',
	'pages.col.status': 'Статус',
	'pages.col.updated': 'Изменена',
	'pages.system': 'Системная',
	'pages.slug': 'Адрес',
	'pages.slugHint':
		'Латиница, цифры и дефисы, например summer-camp. Страница откроется по /pages/…',
	'pages.slugSystem': 'Адрес системной страницы изменить нельзя.',
	'pages.title': 'Заголовок',
	'pages.body': 'Текст',
	'pages.status': 'Статус',
	'pages.status.draft': 'Черновик',
	'pages.status.published': 'Опубликована',
	'pages.status.archived': 'В архиве',
	'pages.open': 'Открыть на сайте',
	'pages.delete': 'Удалить',
	'pages.deleteTitle': 'Удалить страницу?',
	'pages.deleteText': 'Страница пропадёт с сайта и из этого списка.',
	'pages.systemNoDelete': 'Системные страницы не удаляются, только редактируются.',
	'pages.error.slug': 'Только строчная латиница, цифры и одиночные дефисы',
	'pages.error.slugTaken': 'Этот адрес уже занят',
	'pages.error.status': 'Выберите статус',
	'media.usage.page': 'Страница'
};
