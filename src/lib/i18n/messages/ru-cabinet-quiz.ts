import type { Messages } from '../translate';

/** Кабинет «Обучение»: тест курса и письмо с результатом. Часть `ruCabinet`. */
export const ruCabinetQuiz: Partial<Messages> = {
	'cabinet.quiz.title': 'Тест',
	'cabinet.quiz.go': 'К тесту',
	'cabinet.quiz.rules':
		'Вопросов: {size}, чтобы сдать, нужно {need} правильных, время — {minutes} мин.',
	'cabinet.quiz.attemptsLeft': 'Попыток осталось в периоде: {left} из {limit}.',
	'cabinet.quiz.extraLeft': 'Внеочередных попыток от федерации: {count}.',
	'cabinet.quiz.oneTry': 'Попытка считается с начала: если уйти со страницы, она потрачена.',
	'cabinet.quiz.start': 'Начать',
	'cabinet.quiz.startExtra': 'Начать внеочередную попытку',
	'cabinet.quiz.state.open': 'Можно пройти тест.',
	'cabinet.quiz.state.running': 'Идёт попытка.',
	'cabinet.quiz.state.passed': 'Тест сдан.',
	'cabinet.quiz.state.finished': 'Курс пройден.',
	'cabinet.quiz.state.membership': 'Для теста нужно действующее членство.',
	'cabinet.quiz.state.wait': 'Следующая попытка — с {date}.',
	'cabinet.quiz.state.bank': 'Тест пока недоступен. Напишите в федерацию.',
	'cabinet.quiz.state.preview': 'Предпросмотр: тест сдают только по одобренной заявке.',
	'cabinet.quiz.timeLeft': 'Осталось времени',
	'cabinet.quiz.question': 'Вопрос {n} из {total}',
	'cabinet.quiz.finish': 'Завершить',
	'cabinet.quiz.confirm': 'Завершить попытку? Вопросы без ответа считаются неправильными.',
	'cabinet.quiz.saveFailed':
		'Последний ответ ещё не сохранён: проверьте связь. Ответы также отправятся по кнопке «Завершить».',
	'cabinet.quiz.result': 'Правильных: {correct} из {total}.',
	'cabinet.quiz.passed': 'Сдан',
	'cabinet.quiz.failed': 'Не сдан',
	'cabinet.quiz.expired': 'Время вышло: засчитаны ответы, сохранённые до конца срока.',
	'cabinet.quiz.history': 'Попытки',
	'cabinet.quiz.extra': 'внеочередная',
	'cabinet.quiz.error.start': 'Сейчас начать попытку нельзя: причина — выше.',
	'cabinet.quiz.error.closed': 'Эта попытка уже завершена.',
	'training.mail.quizPassed.subject': 'Тест сдан',
	'training.mail.quizPassed.text':
		'Здравствуйте, {name}!\n\nВы сдали тест курса «{course}»: правильных {correct} из {total} (нужно {need}).\n\nТест: {url}',
	'training.mail.quizFailed.subject': 'Тест не сдан',
	'training.mail.quizFailed.text':
		'Здравствуйте, {name}!\n\nТест курса «{course}» не сдан: правильных {correct} из {total}, нужно {need}.\n\nПересдать можно: {retake}.\n\nТест: {url}',
	'training.mail.quizRetakeNow': 'сразу'
};
