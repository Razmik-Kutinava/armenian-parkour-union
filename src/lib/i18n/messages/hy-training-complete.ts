import type { Messages } from '../translate';

/** Ուսուցում․ դասընթացն ավարտված է — նամակներ, առաջընթաց դասընթացների ցանկում։ Մաս `hyCabinet`-ի։ */
export const hyTrainingComplete: Partial<Messages> = {
	'cabinet.training.quizPassed': 'Թեստ՝ հանձնված է։',
	'cabinet.training.quizNotPassed': 'Թեստ՝ դեռ հանձնված չէ։',
	'cabinet.training.quizRetake': 'Թեստ՝ հանձնված չէ, վերահանձնում՝ {date}-ից։',
	'cabinet.training.practiceProgress': 'Պրակտիկա՝ ընդունված է {accepted}-ը {total}-ից։',
	'cabinet.training.certified': 'Դասընթացն ավարտված է, վկայականը տրամադրված է։',
	'cabinet.training.toCertificate': 'Բացել վկայականը',
	'training.exam.notes': 'Ուսումնական պորտալ՝ թեստ {correct}/{total}, պրակտիկա {accepted}/{tasks}',
	'training.mail.courseFinishedAdmin.subject':
		'Դասընթացն ավարտված է — թույլտվություն առկա փուլերի համար',
	'training.mail.courseFinishedAdmin.text':
		'«{course}» դասընթացի հեռակա մասն ավարտված է․ մասնակից՝ {name}։ Ստեղծվել է «հանձնված» քննություն։ Ատեստավորման առկա փուլերից հետո տրամադրեք վկայականը քննության քարտից՝ {url}',
	'training.mail.courseFinished.subject': 'Դասընթացն ավարտված է․ հեռակա մաս',
	'training.mail.courseFinished.text':
		'Բարև, {name}։\n\nԴուք ավարտել եք «{course}» դասընթացի հեռակա մասը․ թեստը հանձնված է, պրակտիկայի բոլոր տեսանյութերն ընդունված են։ Սա թույլտվություն է ատեստավորման առկա փուլերին մասնակցելու համար (տե՛ս ատեստավորման կանոնակարգը պորտալում)։ Ֆեդերացիան վկայականը տրամադրում է առկա փուլերից հետո․ դրանց մասին ձեզ հետ կկապվեն, իսկ վկայականի տրամադրման մասին կստանաք առանձին նամակ։\n\nԴասընթացներ՝ {url}'
};
