import type { Messages } from '../translate';

/** Admin "Training": quiz attempts. Part of `hyTrainingAdmin`. */
export const hyTrainingAttempts: Partial<Messages> = {
	'admin.nav.trainingAttempts': 'Փորձեր',
	'training.attempts.empty': 'Փորձեր չեն գտնվել',
	'training.attempts.filter.course': 'Դասընթաց',
	'training.attempts.filter.result': 'Արդյունք',
	'training.attempts.filter.from': 'Սկիզբը՝ սկսած',
	'training.attempts.filter.to': 'Սկիզբը՝ մինչև',
	'training.attempts.result.all': 'Բոլորը',
	'training.attempts.result.passed': 'Հանձնել է',
	'training.attempts.result.failed': 'Չի հանձնել',
	'training.attempts.result.running': 'Ընթացքում է',
	'training.attempts.result.expired': 'Ժամանակը սպառվել է, փակված չէ',
	'training.attempts.col.member': 'Մասնակից',
	'training.attempts.col.course': 'Դասընթաց',
	'training.attempts.col.started': 'Սկիզբ',
	'training.attempts.col.score': 'Ճիշտ / ընդամենը',
	'training.attempts.col.result': 'Արդյունք',
	'training.attempts.col.extra': 'Արտահերթ',
	'training.attempts.extra': 'Արտահերթ փորձ',
	'training.attempts.back': 'Բոլոր փորձերը',
	'training.attempts.title': 'Թեստի փորձ',
	'training.attempts.started': 'Սկիզբ՝ {date}',
	'training.attempts.ended': 'Ավարտ՝ {date}',
	'training.attempts.until': 'Ընթացքում է մինչև {date}',
	'training.attempts.score': 'Ճիշտ՝ {correct}-ը {total}-ից, հանձնելու համար պետք է {pass}',
	'training.attempts.noScore': 'Դեռ հաշվված չէ՝ {total} հարց, հանձնելու համար պետք է {pass}',
	'training.attempts.limit':
		'Սովորական փորձեր վերջին {days} օրում՝ {used}-ը {limit}-ից (դասընթացի կարգավորումներ)',
	'training.attempts.extraLeft': 'Հասանելի արտահերթ փորձեր՝ {extra}',
	'training.attempts.runningHint':
		'Հարցերն ու պատասխանները երևում են փորձի ավարտից հետո, որպեսզի ոչ ոք չտեսնի ճիշտ պատասխանները, քանի դեռ մասնակիցը պատասխանում է։',
	'training.attempts.questions': 'Հարցեր',
	'training.attempts.answer': 'Պատասխան',
	'training.attempts.rightAnswer': 'Ճիշտ պատասխան',
	'training.attempts.noAnswer': 'Պատասխան չկա',
	'training.attempts.mark.right': 'Ճիշտ է',
	'training.attempts.mark.wrong': 'Սխալ է',
	'training.attempts.mark.none': 'Առանց պատասխանի'
};
