import type { Messages } from '../translate';

/** Обучение: курс завершён — письма, заметка экзамена, прогресс в списке курсов. Часть `ruCabinet`. */
export const ruTrainingComplete: Partial<Messages> = {
	'cabinet.training.quizPassed': 'Тест: сдан.',
	'cabinet.training.quizNotPassed': 'Тест: ещё не сдан.',
	'cabinet.training.quizRetake': 'Тест: не сдан, пересдача с {date}.',
	'cabinet.training.practiceProgress': 'Практика: принято {accepted} из {total}.',
	'cabinet.training.certified': 'Курс пройден, сертификат выдан.',
	'cabinet.training.toCertificate': 'Открыть сертификат',
	'training.exam.notes': 'Обучающий портал: тест {correct}/{total}, практика {accepted}/{tasks}',
	'training.mail.courseFinishedAdmin.subject': 'Курс пройден — нужно выдать сертификат',
	'training.mail.courseFinishedAdmin.text':
		'{name} прошёл(а) курс «{course}»: создан экзамен «сдан». Выдайте сертификат из карточки экзамена: {url}',
	'training.mail.courseFinished.subject': 'Курс пройден',
	'training.mail.courseFinished.text':
		'Здравствуйте, {name}!\n\nВы прошли курс «{course}»: тест сдан, все практические видео приняты. Курс ждёт выдачи сертификата — его выдаст федерация, об этом придёт отдельное письмо.\n\nКурсы: {url}'
};
