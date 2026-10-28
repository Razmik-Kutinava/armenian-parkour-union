import type { Messages } from '../translate';

/** Админка «Обучение»: попытки теста. Часть `ruTrainingAdmin`. */
export const ruTrainingAttempts: Partial<Messages> = {
	'admin.nav.trainingAttempts': 'Попытки',
	'training.attempts.empty': 'Попыток не найдено',
	'training.attempts.filter.course': 'Курс',
	'training.attempts.filter.result': 'Результат',
	'training.attempts.filter.from': 'Начало с',
	'training.attempts.filter.to': 'Начало по',
	'training.attempts.result.all': 'Все',
	'training.attempts.result.passed': 'Сдал',
	'training.attempts.result.failed': 'Не сдал',
	'training.attempts.result.running': 'Идёт',
	'training.attempts.result.expired': 'Время вышло, не закрыта',
	'training.attempts.col.member': 'Участник',
	'training.attempts.col.course': 'Курс',
	'training.attempts.col.started': 'Начало',
	'training.attempts.col.score': 'Правильных / всего',
	'training.attempts.col.result': 'Результат',
	'training.attempts.col.extra': 'Внеочередная',
	'training.attempts.extra': 'Внеочередная попытка',
	'training.attempts.back': 'Все попытки',
	'training.attempts.title': 'Попытка теста',
	'training.attempts.started': 'Начало: {date}',
	'training.attempts.ended': 'Окончание: {date}',
	'training.attempts.until': 'Идёт до {date}',
	'training.attempts.score': 'Правильных: {correct} из {total}, для сдачи нужно {pass}',
	'training.attempts.noScore': 'Ещё не подсчитана: вопросов {total}, для сдачи нужно {pass}',
	'training.attempts.limit':
		'Обычных попыток за последние {days} дн.: {used} из {limit} (настройки курса)',
	'training.attempts.extraLeft': 'Внеочередных доступно: {extra}',
	'training.attempts.runningHint':
		'Вопросы и ответы видны после окончания попытки, чтобы правильные ответы никто не видел, пока участник отвечает.',
	'training.attempts.questions': 'Вопросы',
	'training.attempts.answer': 'Ответ',
	'training.attempts.rightAnswer': 'Правильный ответ',
	'training.attempts.noAnswer': 'Нет ответа',
	'training.attempts.mark.right': 'Верно',
	'training.attempts.mark.wrong': 'Неверно',
	'training.attempts.mark.none': 'Без ответа'
};
