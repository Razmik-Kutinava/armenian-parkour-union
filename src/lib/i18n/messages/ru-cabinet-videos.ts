import type { Messages } from '../translate';

export const ruCabinetVideos: Partial<Messages> = {
	'cabinet.nav.videos': 'Видео',
	'cabinet.videos.title': 'Мои видео',
	'cabinet.videos.intro':
		'Добавьте ссылку на своё видео. Модератор проверит его, за одобренное видео начисляются баллы.',
	'cabinet.videos.add': 'Добавить видео',
	'cabinet.videos.url': 'Ссылка',
	'cabinet.videos.urlHint': '{platforms}; не больше {limit} видео в месяц.',
	'cabinet.videos.videoTitle': 'Название',
	'cabinet.videos.event': 'Событие (необязательно)',
	'cabinet.videos.noEvent': 'Не с события',
	'cabinet.videos.submit': 'Добавить',
	'cabinet.videos.added': 'Видео добавлено. Модератор его проверит.',
	'cabinet.videos.list': 'Добавленные видео',
	'cabinet.videos.empty': 'Видео пока нет.',
	'cabinet.videos.needMembership': 'Добавлять видео можно с активным членством.',
	'cabinet.videos.toMembership': 'Членство',
	'videos.status.pending': 'На проверке',
	'videos.status.approved': 'Одобрено',
	'videos.status.rejected': 'Отклонено',
	'videos.error.url': 'Вставьте ссылку на видео.',
	'videos.error.title': 'Введите название.',
	'videos.error.platform': 'Такая ссылка не принимается: только платформы, указанные под полем.',
	'videos.error.duplicate': 'Вы уже добавили это видео.',
	'videos.error.limit': 'В этом месяце уже добавлено {limit} видео — это предел.',
	'videos.error.event': 'Выберите событие из списка.',
	'videos.error.membership': 'Добавлять видео можно с активным членством.'
};
