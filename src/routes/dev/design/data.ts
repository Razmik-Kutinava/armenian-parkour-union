/* Dev-only showcase data; not user-facing UI text. */
export interface Sample {
	lang: 'hy' | 'ru' | 'en';
	title: string;
	subtitle: string;
	body: string;
	action: string;
	secondary: string;
}

export const samples: Sample[] = [
	{
		lang: 'hy',
		title: 'Հայաստանի պարկուրի միություն',
		subtitle: 'Մարզումներ, մրցումներ և սերտիֆիկատներ',
		body: 'Պարկուրը շարժման արվեստ է՝ վազք, ցատկ և մագլցում քաղաքային միջավայրում։ Միացե՛ք մեր մարզումներին Երևանում և մարզերում։',
		action: 'Գրանցվել միջոցառմանը',
		secondary: 'Իմանալ ավելին'
	},
	{
		lang: 'ru',
		title: 'Федерация паркура Армении',
		subtitle: 'Тренировки, соревнования и сертификаты',
		body: 'Паркур — искусство движения: бег, прыжки и лазание в городской среде. Присоединяйтесь к тренировкам в Ереване и регионах.',
		action: 'Записаться на событие',
		secondary: 'Подробнее'
	},
	{
		lang: 'en',
		title: 'Armenian Parkour Union',
		subtitle: 'Training, competitions and certificates',
		body: 'Parkour is the art of movement: running, jumping and climbing in the city. Join our training sessions in Yerevan and the regions.',
		action: 'Register for event',
		secondary: 'Learn more'
	}
];
