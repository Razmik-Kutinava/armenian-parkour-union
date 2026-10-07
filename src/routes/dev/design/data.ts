/* Dev-only showcase data; not user-facing UI text. */
export interface FontSet {
	id: string;
	name: string;
	note: string;
	display: string;
	body: string;
}

export const fontSets: FontSet[] = [
	{
		id: 'arian',
		name: 'Arian AMU',
		note: 'Armenian designer (R. Tarumian); Armenian + Latin + Cyrillic in one family; free license; 400/700',
		display: "'Arian AMU', system-ui, sans-serif",
		body: "'Arian AMU', system-ui, sans-serif"
	},
	{
		id: 'mardoto',
		name: 'Mardoto',
		note: 'Armenian in Roboto style; OFL; Cyrillic falls back to Inter if missing',
		display: "'Mardoto', 'Inter', system-ui, sans-serif",
		body: "'Mardoto', 'Inter', system-ui, sans-serif"
	},
	{
		id: 'proposal',
		name: 'Unbounded + Inter + Noto',
		note: 'Current proposal in 08-DESIGN: wide sporty headings; Armenian from Noto Sans Armenian',
		display: "'Unbounded', 'Noto Sans Armenian', system-ui, sans-serif",
		body: "'Inter', 'Noto Sans Armenian', system-ui, sans-serif"
	},
	{
		id: 'calm',
		name: 'Inter + Noto',
		note: 'Calm variant: Inter everywhere, Armenian from Noto Sans Armenian',
		display: "'Inter', 'Noto Sans Armenian', system-ui, sans-serif",
		body: "'Inter', 'Noto Sans Armenian', system-ui, sans-serif"
	}
];

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
