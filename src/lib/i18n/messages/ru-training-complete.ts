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
	'training.mail.courseFinishedAdmin.subject': 'Курс пройден — допуск к очным этапам',
	'training.mail.courseFinishedAdmin.text':
		'{name} прошёл(а) заочную часть курса «{course}»: создан экзамен «сдан». После очных этапов аттестации выдайте сертификат из карточки экзамена: {url}',
	'training.mail.courseFinished.subject': 'Курс пройден: заочная часть',
	'training.mail.courseFinished.text':
		'Здравствуйте, {name}!\n\nВы прошли заочную часть курса «{course}»: тест сдан, все практические видео приняты. Это допуск к очным этапам аттестации (Положение об аттестации на портале). Сертификат федерация выдаёт после очных этапов — о них с вами свяжутся, о выдаче сертификата придёт отдельное письмо.\n\nКурсы: {url}'
};
