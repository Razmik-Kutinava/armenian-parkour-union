import type { Messages } from '../translate';

/** Кабинет «Обучение»: курсы и заявки на доступ. Часть `ruCabinet`. */
export const ruCabinetTraining: Partial<Messages> = {
	'cabinet.nav.training': 'Обучение',
	'cabinet.training.intro':
		'Курсы федерации: уроки, тест и практика, которые ведут к экзамену и сертификату.',
	'cabinet.training.empty': 'Курсов пока нет.',
	'cabinet.training.need': 'Чтобы подать заявку, нужно: {list}.',
	'cabinet.training.need.membership': 'действующее членство',
	'cabinet.training.need.age': 'возраст от {age} лет (дата рождения — в профиле)',
	'cabinet.training.need.level': 'степень «{level}» или выше',
	'cabinet.training.apply': 'Запросить доступ',
	'cabinet.training.applyAgain': 'Подать снова',
	'cabinet.training.pending': 'Заявка на рассмотрении. О решении сообщим письмом.',
	'cabinet.training.rejected': 'Заявка отклонена. Причина: {reason}',
	'cabinet.training.revoked': 'Доступ к курсу закрыт. Причина: {reason}',
	'cabinet.training.approved': 'Доступ открыт.',
	'cabinet.training.open': 'Открыть портал',
	'cabinet.training.finished': 'Курс пройден, ждёт выдачи сертификата.',
	'cabinet.training.applied': 'Заявка отправлена. О решении сообщим письмом.',
	'cabinet.training.error.state': 'Заявка уже подана или по ней есть решение. Обновите страницу.',
	'cabinet.training.error.blocked': 'Ваш аккаунт заблокирован.',
	'cabinet.training.error.gone': 'Курс больше недоступен.',
	'cabinet.training.error.conditions': 'Условия курса не выполнены.',
	'cabinet.training.allCourses': 'Все курсы',
	'cabinet.training.preview':
		'Предпросмотр: вы видите портал так же, как участники. Тест и практику сдают только через заявку.',
	'cabinet.training.noLessons': 'Уроков пока нет.',
	'cabinet.training.otherLessons': 'Другие уроки',
	'cabinet.training.withPdf': 'PDF',
	'cabinet.training.downloadPdf': 'Скачать PDF',
	'cabinet.training.backToCourse': 'К курсу',
	'cabinet.action.portal': 'Доступ к курсу «{course}» открыт.'
};
