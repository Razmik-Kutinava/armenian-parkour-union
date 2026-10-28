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
	'training.mail.courseFinishedAdmin.subject': 'Դասընթացն ավարտված է — պետք է տրամադրել վկայական',
	'training.mail.courseFinishedAdmin.text':
		'{name}-ն ավարտել է «{course}» դասընթացը․ ստեղծվել է «հանձնված» քննություն։ Տրամադրեք վկայականը քննության քարտից՝ {url}',
	'training.mail.courseFinished.subject': 'Դասընթացն ավարտված է',
	'training.mail.courseFinished.text':
		'Բարև, {name}։\n\nԴուք ավարտել եք «{course}» դասընթացը․ թեստը հանձնված է, պրակտիկայի բոլոր տեսանյութերն ընդունված են։ Դասընթացը սպասում է վկայականի տրամադրմանը․ այն կտրամադրի ֆեդերացիան, և դուք կստանաք առանձին նամակ։\n\nԴասընթացներ՝ {url}'
};
