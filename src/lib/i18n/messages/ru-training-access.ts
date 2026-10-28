import type { Messages } from '../translate';

/** Админка «Обучение»: заявки на доступ и письма. Часть `ruTrainingAdmin`. */
export const ruTrainingAccess: Partial<Messages> = {
	'admin.nav.trainingAccess': 'Заявки',
	'training.access.empty': 'Заявок не найдено',
	'training.access.filter.course': 'Курс',
	'training.access.filter.allCourses': 'Все курсы',
	'training.access.filter.status': 'Статус',
	'training.access.status.all': 'Все',
	'training.access.status.pending': 'На рассмотрении',
	'training.access.status.approved': 'Одобрена',
	'training.access.status.rejected': 'Отклонена',
	'training.access.status.revoked': 'Доступ закрыт',
	'training.access.col.member': 'Участник',
	'training.access.col.course': 'Курс',
	'training.access.col.date': 'Дата',
	'training.access.col.status': 'Статус',
	'training.access.col.age': 'Возраст',
	'training.access.col.level': 'Степень',
	'training.access.col.paidUntil': 'Членство до',
	'training.access.col.actions': 'Решение',
	'training.access.none': '—',
	'training.access.approve': 'Одобрить',
	'training.access.reject': 'Отклонить',
	'training.access.revoke': 'Закрыть доступ',
	'training.access.search': 'Имя участника',
	'training.access.rejectTitle': 'Отклонить заявку',
	'training.access.rejectText':
		'Участник получит письмо с причиной и сможет подать заявку снова. Причина видна в кабинете.',
	'training.access.revokeTitle': 'Закрыть доступ к курсу',
	'training.access.revokeText':
		'Портал закроется для участника; попытки и видео останутся в истории. Участник получит письмо с причиной и не сможет подать заявку снова.',
	'training.access.done.approve': 'Заявка одобрена, участнику отправлено письмо.',
	'training.access.done.reject': 'Заявка отклонена, участнику отправлено письмо.',
	'training.access.done.revoke': 'Доступ закрыт, участнику отправлено письмо.',
	'training.access.error.reason': 'Укажите причину, до 1000 символов.',
	'training.access.error.state': 'По заявке уже есть решение. Обновите страницу.',
	'training.access.extra': 'Внеочередная попытка',
	'training.access.extraTitle': 'Выдать внеочередную попытку теста',
	'training.access.extraText':
		'Участник сможет пройти тест ещё раз без паузы и лимита попыток. Действие пишется в журнал.',
	'training.access.extraUnused': 'Невыданных внеочередных попыток: {count}',
	'training.access.done.extra': 'Внеочередная попытка выдана.',
	'training.access.error.extraState':
		'Внеочередную попытку можно выдать только по одобренной заявке, пока тест не сдан. Обновите страницу.',
	'training.access.error.conditions':
		'Участник больше не подходит под условия курса ({missing}). Отклоните заявку или подождите.',
	'training.missing.membership': 'действующее членство',
	'training.missing.age': 'возраст',
	'training.missing.level': 'степень',
	'training.mail.request.subject': 'Новая заявка на курс',
	'training.mail.request.text': '{name} просит доступ к курсу «{course}».\n\nЗаявки: {url}',
	'training.mail.approved.subject': 'Доступ к курсу открыт',
	'training.mail.approved.text':
		'Здравствуйте, {name}!\n\nВаша заявка на курс «{course}» одобрена.\n\nПортал курса: {url}',
	'training.mail.rejected.subject': 'Заявка на курс отклонена',
	'training.mail.rejected.text':
		'Здравствуйте, {name}!\n\nВаша заявка на курс «{course}» отклонена. Причина: {reason}\n\nПодать заявку снова: {url}',
	'training.mail.revoked.subject': 'Доступ к курсу закрыт',
	'training.mail.revoked.text':
		'Здравствуйте, {name}!\n\nВаш доступ к курсу «{course}» закрыт. Причина: {reason}\n\nОбучение: {url}'
};
