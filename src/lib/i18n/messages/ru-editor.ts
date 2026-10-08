import type { enEditor } from './en-editor';

/** Редактор текста в админке. Часть `ru`. */
export const ruEditor: Record<keyof typeof enEditor, string> = {
	'editor.toolbar': 'Форматирование',
	'editor.heading2': 'Заголовок',
	'editor.heading3': 'Подзаголовок',
	'editor.bold': 'Жирный',
	'editor.italic': 'Курсив',
	'editor.bulletList': 'Маркированный список',
	'editor.orderedList': 'Нумерованный список',
	'editor.quote': 'Цитата',
	'editor.link': 'Ссылка',
	'editor.image': 'Изображение',
	'editor.video': 'Видео YouTube',
	'editor.undo': 'Отменить',
	'editor.redo': 'Повторить',
	'editor.insert': 'Вставить',
	'editor.remove': 'Убрать ссылку',
	'editor.url': 'Адрес',
	'editor.linkHint': 'https://…, mailto:… или путь на сайте, например /ru/events',
	'editor.imageHint': 'Скопируйте ссылку изображения в медиабиблиотеке и вставьте сюда.',
	'editor.videoHint': 'Ссылка на видео YouTube.',
	'editor.badVideo': 'Это не ссылка на видео YouTube',
	'editor.alt': 'Alt-текст'
};
