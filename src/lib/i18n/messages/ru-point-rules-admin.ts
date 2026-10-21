import type { Messages } from '../translate';

/** Админка «Правила баллов» и фильтр «подозрительное» (docs/05 разделы 12–13). Часть `ru`. */
export const ruPointRulesAdmin: Partial<Messages> = {
	'points.filter.suspicious': 'Подозрительное',
	'pointRules.col.code': 'Код',
	'pointRules.col.title': 'Название',
	'pointRules.col.points': 'Баллы',
	'pointRules.col.active': 'Активно',
	'pointRules.col.updated': 'Изменено',
	'pointRules.yes': 'Да',
	'pointRules.off': 'Выключено',
	'pointRules.seed': 'не менялось',
	'pointRules.hint':
		'Изменение действует только на будущие начисления: выданные баллы остаются. Правило с 0 баллов ничего не начисляет. Коды заданы в коде сайта, добавить их здесь нельзя.',
	'pointRules.empty': 'Правил пока нет: запустите seed.',
	'pointRules.code': 'Код: {code}',
	'pointRules.title': 'Название',
	'pointRules.points': 'Баллы',
	'pointRules.pointsHint': 'Целое число от 0 до 1 000 000; 0 — ничего не начисляется.',
	'pointRules.active': 'Активно',
	'pointRules.saved': 'Сохранено. Новые значения действуют для будущих начислений.',
	'pointRules.th.title': 'Подозрительные записи в журнале',
	'pointRules.th.hint':
		'Фильтр «Подозрительное» в журнале баллов показывает запись, если выполнено любое из условий.',
	'pointRules.th.manual': 'Все ручные операции',
	'pointRules.th.minAmount': 'Сумма от',
	'pointRules.th.burstCount': 'Записей у участника',
	'pointRules.th.burstHours': 'За, часов',
	'pointRules.th.save': 'Сохранить пороги',
	'pointRules.th.saved': 'Пороги сохранены.',
	'pointRules.error.points': 'Введите целое число от 0 до 1 000 000.',
	'pointRules.error.minAmount': 'Введите целое число от 1 до 1 000 000 000.',
	'pointRules.error.burstCount': 'Введите целое число от 2 до 1000.',
	'pointRules.error.burstHours': 'Введите целое число часов от 1 до 720.'
};
