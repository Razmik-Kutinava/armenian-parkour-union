import type { Messages } from '../translate';

export const ruVideosAdmin: Partial<Messages> = {
	'videos.status.hidden': 'Скрыто',
	'videos.platform.youtube': 'YouTube',
	'videos.platform.instagram': 'Instagram',
	'videos.platform.tiktok': 'TikTok',
	'videos.platform.other': 'Другая',
	'videos.admin.search': 'Поиск по имени',
	'videos.admin.filter.all': 'Все',
	'videos.admin.col.member': 'Участник',
	'videos.admin.col.video': 'Видео',
	'videos.admin.col.platform': 'Платформа',
	'videos.admin.col.event': 'Событие',
	'videos.admin.col.createdAt': 'Добавлено',
	'videos.admin.col.status': 'Статус',
	'videos.admin.col.actions': 'Действия',
	'videos.admin.untitled': 'Видео без названия',
	'videos.admin.openHint': 'Откроется на платформе в новой вкладке',
	'videos.admin.approve': 'Одобрить',
	'videos.admin.reject': 'Отклонить',
	'videos.admin.hide': 'Скрыть',
	'videos.admin.selected': 'Выбрано: {count}',
	'videos.admin.approveSelected': 'Одобрить выбранные',
	'videos.admin.rejectSelected': 'Отклонить выбранные',
	'videos.admin.hideSelected': 'Скрыть выбранные',
	'videos.admin.rejectTitle': 'Отклонить видео: {count}',
	'videos.admin.rejectText':
		'Участник получит письмо с причиной. За отклонённое видео баллы не начисляются.',
	'videos.admin.result': 'Сделано: {done}. Пропущено: {skipped}.',
	'videos.admin.skippedHint':
		'Пропущены: уже решённые, ещё не одобренные (для скрытия), ваши собственные или видео удалённых аккаунтов.',
	'videos.admin.empty': 'Видео нет.',
	'videos.admin.error.select': 'Выберите хотя бы одно видео.',
	'videos.admin.error.tooMany': 'Не больше 25 видео за раз.',
	'videos.admin.error.reason': 'Укажите причину отказа.',
	'videos.mail.approved.subject': 'Ваше видео одобрено',
	'videos.mail.approved.text':
		'Здравствуйте, {name}!\n\nМодератор одобрил ваше видео «{title}».\n\nВаши видео: {url}',
	'videos.mail.approved.textPoints':
		'Здравствуйте, {name}!\n\nМодератор одобрил ваше видео «{title}». Начислено баллов: {points}.\n\nВаши видео: {url}',
	'videos.mail.rejected.subject': 'Ваше видео не одобрено',
	'videos.mail.rejected.text':
		'Здравствуйте, {name}!\n\nВаше видео «{title}» не одобрено. Причина: {reason}\n\nВаши видео: {url}',
	'settings.tab.videos': 'Видео',
	'videos.settings.section': 'Видео участников',
	'videos.settings.sectionHint':
		'Отклонённые видео входят в лимит, удалённые участником — нет. Месяц — календарный, по Еревану.',
	'videos.settings.limit': 'Видео в месяц',
	'videos.settings.limitHint': 'Сколько видео один участник может добавить за месяц, от 1 до 100.',
	'videos.settings.platforms': 'Разрешённые платформы',
	'videos.settings.error.limit': 'От 1 до 100.',
	'videos.settings.error.platforms': 'Выберите хотя бы одну платформу.'
};
