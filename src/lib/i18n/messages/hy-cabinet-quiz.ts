import type { Messages } from '../translate';

/** Cabinet "Training": the course quiz and its letter. Part of `hyCabinet`. */
export const hyCabinetQuiz: Partial<Messages> = {
	'cabinet.quiz.title': 'Թեստ',
	'cabinet.quiz.go': 'Անցնել թեստին',
	'cabinet.quiz.rules':
		'Հարցեր՝ {size}, հանձնելու համար՝ {need} ճիշտ պատասխան, ժամանակը՝ {minutes} րոպե։',
	'cabinet.quiz.attemptsLeft': 'Ժամանակահատվածում մնացած փորձեր՝ {left} / {limit}։',
	'cabinet.quiz.extraLeft': 'Ֆեդերացիայի արտահերթ փորձեր՝ {count}։',
	'cabinet.quiz.oneTry': 'Փորձը հաշվվում է սկզբից․ եթե լքեք էջը, այն կհամարվի օգտագործված։',
	'cabinet.quiz.start': 'Սկսել',
	'cabinet.quiz.startExtra': 'Սկսել արտահերթ փորձը',
	'cabinet.quiz.state.open': 'Կարող եք անցնել թեստը։',
	'cabinet.quiz.state.running': 'Փորձն ընթացքի մեջ է։',
	'cabinet.quiz.state.passed': 'Թեստը հանձնված է։',
	'cabinet.quiz.state.finished': 'Դասընթացն ավարտված է։',
	'cabinet.quiz.state.membership': 'Թեստի համար անհրաժեշտ է գործող անդամակցություն։',
	'cabinet.quiz.state.wait': 'Հաջորդ փորձը՝ {date}-ից։',
	'cabinet.quiz.state.bank': 'Թեստը դեռ հասանելի չէ։ Գրեք ֆեդերացիային։',
	'cabinet.quiz.state.preview': 'Նախադիտում․ թեստը հանձնում են միայն հաստատված հայտով։',
	'cabinet.quiz.timeLeft': 'Մնացած ժամանակը',
	'cabinet.quiz.question': 'Հարց {n} / {total}',
	'cabinet.quiz.finish': 'Ավարտել',
	'cabinet.quiz.confirm': 'Ավարտե՞լ փորձը։ Անպատասխան հարցերը համարվում են սխալ։',
	'cabinet.quiz.saveFailed':
		'Վերջին պատասխանը դեռ պահպանված չէ․ ստուգեք կապը։ Պատասխաններն ուղարկվում են նաև «Ավարտել» կոճակով։',
	'cabinet.quiz.result': 'Ճիշտ՝ {correct} / {total}։',
	'cabinet.quiz.passed': 'Հանձնված է',
	'cabinet.quiz.failed': 'Հանձնված չէ',
	'cabinet.quiz.expired': 'Ժամանակն ավարտվեց․ հաշվվել են մինչև ավարտը պահպանված պատասխանները։',
	'cabinet.quiz.history': 'Փորձեր',
	'cabinet.quiz.extra': 'արտահերթ',
	'cabinet.quiz.error.start': 'Այժմ հնարավոր չէ սկսել փորձը․ պատճառը՝ վերևում։',
	'cabinet.quiz.error.closed': 'Այս փորձն արդեն ավարտված է։',
	'training.mail.quizPassed.subject': 'Թեստը հանձնված է',
	'training.mail.quizPassed.text':
		'Բարև, {name}։\n\nԴուք հանձնեցիք «{course}» դասընթացի թեստը՝ ճիշտ {correct} / {total} (անհրաժեշտ է {need})։\n\nԹեստ՝ {url}',
	'training.mail.quizFailed.subject': 'Թեստը հանձնված չէ',
	'training.mail.quizFailed.text':
		'Բարև, {name}։\n\n«{course}» դասընթացի թեստը հանձնված չէ՝ ճիշտ {correct} / {total}, անհրաժեշտ է {need}։\n\nԿրկին հանձնել կարող եք՝ {retake}։\n\nԹեստ՝ {url}',
	'training.mail.quizRetakeNow': 'անմիջապես'
};
