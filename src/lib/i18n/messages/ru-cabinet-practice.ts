import type { Messages } from '../translate';

/** Кабинет «Обучение»: практические видео и письмо о решении. Часть `ruCabinet`. */
export const ruCabinetPractice: Partial<Messages> = {
	'cabinet.practice.title': 'Практика',
	'cabinet.practice.go': 'К практике',
	'cabinet.practice.progress': 'Принято: {accepted} из {total}.',
	'cabinet.practice.state.open': 'Отправьте ссылку на видео по каждому заданию.',
	'cabinet.practice.state.quiz': 'Практика откроется после сданного теста.',
	'cabinet.practice.state.finished': 'Курс пройден.',
	'cabinet.practice.state.preview': 'Предпросмотр: практику сдают только по одобренной заявке.',
	'cabinet.practice.empty': 'Заданий пока нет.',
	'cabinet.practice.link': 'Ссылка на видео (YouTube или Google Drive)',
	'cabinet.practice.hint':
		'Загрузите ролик с доступом по ссылке (YouTube «Доступ по ссылке» или Google Drive «Все, у кого есть ссылка») и вставьте ссылку. Файлы не принимаются.',
	'cabinet.practice.send': 'Отправить на проверку',
	'cabinet.practice.replace': 'Заменить ссылку',
	'cabinet.practice.status.pending': 'На проверке',
	'cabinet.practice.status.approved': 'Принято',
	'cabinet.practice.status.rejected': 'Вернули',
	'cabinet.practice.note': 'Комментарий: {note}',
	'cabinet.practice.history': 'Отправки',
	'cabinet.practice.video': 'Видео',
	'cabinet.practice.sent': 'Ссылка отправлена на проверку.',
	'cabinet.practice.replaced': 'Ссылка заменена.',
	'cabinet.practice.error.bad_url': 'Вставьте ссылку на видео YouTube или файл Google Drive.',
	'cabinet.practice.error.quiz': 'Практика откроется после сданного теста.',
	'cabinet.practice.error.finished': 'Курс уже пройден.',
	'cabinet.practice.error.bad_state': 'Это задание уже принято.',
	'cabinet.practice.error.preview': 'Предпросмотр: практику сдают только по одобренной заявке.',
	'cabinet.action.retake': 'Видео по курсу «{course}» вернули: переснимите задание.',
	'cabinet.practice.retakeGo': 'К практике',
	'training.mail.practiceApproved.subject': 'Видео по практике принято',
	'training.mail.practiceApproved.text':
		'Здравствуйте, {name}!\n\nВаше видео по заданию «{task}» курса «{course}» принято.\n\nПрактика: {url}',
	'training.mail.practiceRejected.subject': 'Видео по практике вернули',
	'training.mail.practiceRejected.text':
		'Здравствуйте, {name}!\n\nВаше видео по заданию «{task}» курса «{course}» вернули. Комментарий: {note}\n\nПереснимите и отправьте новую ссылку: {url}',
	'training.mail.practiceComment': 'Комментарий: {note}'
};
