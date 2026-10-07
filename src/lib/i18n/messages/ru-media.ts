import type { enMedia } from './en-media';

/** Админка «Медиа». Часть `ru`. */
export const ruMedia: Record<keyof typeof enMedia, string> = {
	'media.upload.title': 'Загрузить файлы',
	'media.upload.choose': 'Выбрать файлы',
	'media.upload.hint':
		'JPEG, PNG, WebP, AVIF или PDF, до 10 МБ каждый. Файлы можно перетащить сюда.',
	'media.upload.uploading': 'Загрузка…',
	'media.upload.done': 'Загружено',
	'media.search': 'Имя файла',
	'media.filter.kind': 'Тип',
	'media.kind.image': 'Изображения',
	'media.kind.pdf': 'PDF',
	'media.empty': 'Файлов пока нет',
	'media.back': 'Все файлы',
	'media.size': 'Размер',
	'media.type': 'Тип',
	'media.uploaded': 'Загружен',
	'media.alt': 'Alt-текст',
	'media.altHint':
		'Опишите изображение для тех, кто его не видит. Для декоративного изображения оставьте пустым.',
	'media.link': 'Ссылка',
	'media.copy': 'Скопировать ссылку',
	'media.copied': 'Ссылка скопирована',
	'media.noLink': 'Ссылка появится, когда будет подключено хранилище файлов.',
	'media.usage.title': 'Где используется',
	'media.usage.none': 'Нигде не используется.',
	'media.usage.user_avatar': 'Аватар пользователя',
	'media.delete': 'Удалить',
	'media.deleteTitle': 'Удалить файл?',
	'media.deleteText': 'Файл пропадёт из библиотеки, выбрать его будет нельзя.',
	'media.inUse': 'Файл используется, удалить нельзя.',
	'media.error.type': 'Этот тип файла нельзя загрузить',
	'media.error.size': 'Файл больше 10 МБ',
	'media.error.empty': 'Файл пустой',
	'media.error.storage': 'Хранилище файлов ещё не подключено.',
	'media.error.missing': 'Файл не дошёл до хранилища. Попробуйте ещё раз.',
	'media.error.failed': 'Не удалось загрузить. Попробуйте ещё раз.'
};
