import type { Messages } from '../translate';

/** Cabinet "Training": courses and access requests. Part of `hyCabinet` (proofreading — a native speaker). */
export const hyCabinetTraining: Partial<Messages> = {
	'cabinet.nav.training': 'Ուսուցում',
	'cabinet.training.intro':
		'Ֆեդերացիայի դասընթացներ՝ դասեր, թեստ և պրակտիկա, որոնք տանում են քննության և վկայականի։',
	'cabinet.training.empty': 'Դասընթացներ դեռ չկան։',
	'cabinet.training.need': 'Հայտ ներկայացնելու համար անհրաժեշտ է՝ {list}։',
	'cabinet.training.need.membership': 'գործող անդամակցություն',
	'cabinet.training.need.age': 'առնվազն {age} տարեկան (ծննդյան ամսաթիվը՝ պրոֆիլում)',
	'cabinet.training.need.level': '«{level}» կամ ավելի բարձր աստիճան',
	'cabinet.training.apply': 'Խնդրել մուտք',
	'cabinet.training.applyAgain': 'Կրկին դիմել',
	'cabinet.training.pending': 'Հայտը քննարկման մեջ է։ Որոշման մասին կտեղեկացնենք նամակով։',
	'cabinet.training.rejected': 'Հայտը մերժված է։ Պատճառը՝ {reason}',
	'cabinet.training.revoked': 'Դասընթացի մուտքը փակված է։ Պատճառը՝ {reason}',
	'cabinet.training.approved': 'Մուտքը բաց է։',
	'cabinet.training.open': 'Բացել պորտալը',
	'cabinet.training.finished': 'Դասընթացն ավարտված է, սպասում է վկայականի տրամադրմանը։',
	'cabinet.training.applied': 'Հայտն ուղարկված է։ Որոշման մասին կտեղեկացնենք նամակով։',
	'cabinet.training.error.state': 'Հայտն արդեն ներկայացված է կամ որոշում կա։ Թարմացրեք էջը։',
	'cabinet.training.error.blocked': 'Ձեր հաշիվն արգելափակված է։',
	'cabinet.training.error.gone': 'Դասընթացն այլևս հասանելի չէ։',
	'cabinet.training.error.conditions': 'Դասընթացի պայմանները չեն կատարված։'
};
