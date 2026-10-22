import type { Messages } from '../translate';

export const hyPointRulesAdmin: Partial<Messages> = {
	'points.filter.suspicious': 'Կասկածելի',
	'pointRules.col.code': 'Կոդ',
	'pointRules.col.title': 'Անվանում',
	'pointRules.col.points': 'Միավորներ',
	'pointRules.col.active': 'Ակտիվ',
	'pointRules.col.updated': 'Փոփոխվել է',
	'pointRules.yes': 'Այո',
	'pointRules.off': 'Անջատված',
	'pointRules.seed': 'չի փոփոխվել',
	'pointRules.hint':
		'Փոփոխությունը կիրառվում է միայն ապագա հաշվարկների համար. արդեն տրված միավորները մնում են։ 0 միավորով կանոնը ոչինչ չի տալիս։ Կոդերը ֆիքսված են կայքի կոդում և այստեղ չեն ավելացվում։',
	'pointRules.readOnly': 'Կանոններն ու շեմերը կարող է փոխել միայն ադմինիստրատորը։',
	'pointRules.empty': 'Կանոններ դեռ չկան. գործարկեք seed սկրիպտը։',
	'pointRules.code': 'Կոդ՝ {code}',
	'pointRules.title': 'Անվանում',
	'pointRules.points': 'Միավորներ',
	'pointRules.pointsHint': 'Ամբողջ թիվ՝ 0-ից 1000. 0-ն ոչինչ չի տալիս։',
	'pointRules.active': 'Ակտիվ',
	'pointRules.saved': 'Պահպանված է։ Նոր արժեքները կիրառվում են ապագա հաշվարկների համար։',
	'pointRules.th.title': 'Կասկածելի գրառումներ մատյանում',
	'pointRules.th.hint':
		'Միավորների մատյանի «Կասկածելի» ֆիլտրը ցույց է տալիս գրառումը, եթե դրանցից որևէ մեկը ճիշտ է։ Հաճախակի գրառումներ՝ անդամի N-րդ գրառումից սկսած՝ նշված ժամերի ընթացքում. ավելի վաղ գրառումները չեն ցուցադրվում։',
	'pointRules.th.manual': 'Բոլոր ձեռքով գործողությունները',
	'pointRules.th.minAmount': 'Գումարը՝ սկսած',
	'pointRules.th.burstCount': 'Մեկ անդամի գրառումներ',
	'pointRules.th.burstHours': 'Ընթացքում, ժամ',
	'pointRules.th.save': 'Պահպանել շեմերը',
	'pointRules.th.saved': 'Շեմերը պահպանված են։',
	'pointRules.error.points': 'Մուտքագրեք ամբողջ թիվ՝ 0-ից 1000։',
	'pointRules.error.minAmount': 'Մուտքագրեք ամբողջ թիվ՝ 1-ից 1 000 000 000։',
	'pointRules.error.burstCount': 'Մուտքագրեք ամբողջ թիվ՝ 2-ից 1000։',
	'pointRules.error.burstHours': 'Մուտքագրեք ժամերի ամբողջ թիվ՝ 1-ից 720։'
};
