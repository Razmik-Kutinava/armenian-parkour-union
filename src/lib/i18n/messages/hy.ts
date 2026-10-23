import type { Messages } from '../translate';
import { hyCabinet } from './hy-cabinet';
import { hyCabinetAvatar } from './hy-cabinet-avatar';
import { hyCabinetPoints } from './hy-cabinet-points';
import { hyConsents } from './hy-consents';
import { hyDonate } from './hy-donate';
import { hyEditor } from './hy-editor';
import { hyEvents } from './hy-events';
import { hyFest } from './hy-fest';
import { hyGoogle } from './hy-google';
import { hyHero } from './hy-hero';
import { hyHome } from './hy-home';
import { hyMedia } from './hy-media';
import { hyMembership } from './hy-membership';
import { hyNews } from './hy-news';
import { hyPages } from './hy-pages';
import { hyPayment } from './hy-payment';
import { hyPaymentsAdmin } from './hy-payments-admin';
import { hyPointRulesAdmin } from './hy-point-rules-admin';
import { hyPointsAdmin } from './hy-points-admin';
import { hyRegistrations } from './hy-registrations';
import { hyRegistrationsAdmin } from './hy-registrations-admin';
import { hySystem } from './hy-system';
import { hyUsers } from './hy-users';

export const hy: Partial<Messages> = {
	...hyUsers,
	...hySystem,
	...hyMedia,
	...hyEditor,
	...hyPages,
	...hyNews,
	...hyEvents,
	...hyFest,
	...hyHero,
	...hyHome,
	...hyGoogle,
	...hyMembership,
	...hyDonate,
	...hyPayment,
	...hyPaymentsAdmin,
	...hyPointsAdmin,
	...hyPointRulesAdmin,
	...hyCabinet,
	...hyCabinetPoints,
	...hyCabinetAvatar,
	...hyConsents,
	...hyRegistrations,
	...hyRegistrationsAdmin,
	'site.description':
		'Armenian Parkour Union՝ միջոցառումներ, նորություններ, անդամակցություն և ատեստավորում։',
	'site.underConstruction': 'Կայքը մշակման փուլում է։',
	'common.close': 'Փակել',

	'nav.skip': 'Անցնել բովանդակությանը',
	'nav.main': 'Գլխավոր ընտրացանկ',
	'nav.menu': 'Ընտրացանկ',
	'nav.events': 'Միջոցառումներ',
	'nav.news': 'Նորություններ',
	'nav.federation': 'Ֆեդերացիա',
	'nav.shop': 'Խանութ',
	'nav.donate': 'Աջակցել',
	'nav.login': 'Մուտք',
	'nav.join': 'Միանալ',
	'nav.account': 'Հաշիվ',
	'nav.cabinet': 'Անձնական էջ',
	'nav.admin': 'Ադմինիստրացիա',
	'nav.logout': 'Ելք',
	'nav.language': 'Լեզու',

	'footer.contacts': 'Կոնտակտներ',
	'footer.map': 'Ցույց տալ քարտեզի վրա',
	'footer.socials': 'Սոցիալական ցանցեր',
	'footer.requisites': 'Վավերապայմաններ',
	'footer.links': 'Տեղեկատվություն',
	'footer.about': 'Ֆեդերացիայի մասին',
	'footer.rules': 'Կանոններ',
	'footer.privacy': 'Գաղտնիության քաղաքականություն',
	'footer.contactsPage': 'Կոնտակտներ',
	'footer.offer': 'Հանրային օֆերտա',
	'footer.refund': 'Վերադարձի քաղաքականություն',

	'error.notFound.title': 'Էջը չի գտնվել',
	'error.notFound.text': 'Այս էջը գոյություն չունի կամ տեղափոխվել է։',
	'error.forbidden.title': 'Մուտքն արգելված է',
	'error.forbidden.text': 'Դուք այս էջը բացելու իրավունք չունեք։',
	'error.request.title': 'Չհաջողվեց բացել էջը',
	'error.server.title': 'Ինչ-որ բան սխալ ընթացավ',
	'error.server.text': 'Մենք արդեն զբաղվում ենք դրանով։ Խնդրում ենք փորձել մի փոքր ուշ։',
	'error.home': 'Գլխավոր էջ',

	'auth.email': 'Էլ. փոստ',
	'auth.password': 'Գաղտնաբառ',
	'auth.passwordHint': '8-ից 128 նիշ։',
	'auth.newPassword': 'Նոր գաղտնաբառ',
	'auth.firstName': 'Անուն',
	'auth.lastName': 'Ազգանուն',
	'auth.birthDate': 'Ծննդյան ամսաթիվ',
	'auth.terms': 'Ընդունում եմ գաղտնիության քաղաքականությունը և կանոնները',
	'auth.guardian.title': 'Ծնող կամ օրինական ներկայացուցիչ',
	'auth.guardian.hint': 'Պարտադիր է մինչև 18 տարեկան մասնակիցների համար։',
	'auth.guardianName': 'Ծնողի կամ օրինական ներկայացուցչի անունը',
	'auth.guardianPhone': 'Ծնողի կամ օրինական ներկայացուցչի հեռախոսը',
	'auth.guardianEmail': 'Ծնողի կամ օրինական ներկայացուցչի էլ. փոստը',

	'auth.register.title': 'Գրանցում',
	'auth.register.submit': 'Գրանցվել',
	'auth.register.haveAccount': 'Արդեն ունե՞ք հաշիվ։ Մուտք գործեք',
	'auth.login.title': 'Մուտք',
	'auth.login.submit': 'Մուտք գործել',
	'auth.login.forgot': 'Մոռացե՞լ եք գաղտնաբառը',
	'auth.login.noAccount': 'Հաշիվ չունե՞ք։ Գրանցվեք',
	'auth.logout.title': 'Ելք',
	'auth.logout.text': 'Ավարտե՞լ աշխատաշրջանն այս սարքում։',
	'auth.logout.submit': 'Ելք',
	'auth.forgot.title': 'Գաղտնաբառի վերականգնում',
	'auth.forgot.text': 'Նշեք ձեր էլ. փոստը, և մենք կուղարկենք նոր գաղտնաբառ սահմանելու հղումը։',
	'auth.forgot.submit': 'Ուղարկել հղումը',
	'auth.forgot.sent':
		'Եթե այս էլ. փոստը գրանցված է, մենք դրան հղում ենք ուղարկել։ Այն գործում է 1 ժամ։',
	'auth.reset.title': 'Նոր գաղտնաբառ',
	'auth.reset.submit': 'Պահպանել գաղտնաբառը',
	'auth.reset.done': 'Գաղտնաբառը փոխված է։ Մուտք գործեք նոր գաղտնաբառով։',
	'auth.verify.title': 'Էլ. փոստի հաստատում',
	'auth.verify.done': 'Էլ. փոստը հաստատված է։ Շնորհակալություն։',
	'auth.linkInvalid': 'Հղումն անվավեր է կամ ժամկետանց։ Պահանջեք նորը։',

	'auth.error.required': 'Լրացրեք դաշտը։',
	'auth.error.tooLong': 'Չափազանց երկար է։',
	'auth.error.email': 'Մուտքագրեք ճիշտ էլ. փոստ։',
	'auth.error.passwordLength': 'Գաղտնաբառը պետք է լինի 8-ից 128 նիշ։',
	'auth.error.birthDate': 'Մուտքագրեք ճիշտ ծննդյան ամսաթիվ։',
	'auth.error.terms': 'Անհրաժեշտ է ընդունել գաղտնիության քաղաքականությունը և կանոնները։',
	'auth.error.phone': 'Մուտքագրեք ճիշտ հեռախոսահամար։',
	'auth.error.invalid': 'Սխալ էլ. փոստ կամ գաղտնաբառ։',
	'auth.error.blocked': 'Հաշիվն արգելափակված է։ Կապվեք ֆեդերացիայի հետ։',
	'auth.error.limited': 'Չափազանց շատ փորձեր։ Փորձեք ավելի ուշ։',
	'auth.error.exists': 'Այս էլ. փոստով հաշիվ արդեն կա։',

	'admin.title': 'Ադմինիստրատիվ վահանակ',
	'admin.sections': 'Ադմինիստրացիայի բաժիններ',
	'admin.breadcrumbs': 'Նավիգացիոն շղթա',
	'admin.toSite': 'Բացել կայքը',
	'admin.group.overview': 'Ակնարկ',
	'admin.group.content': 'Բովանդակություն',
	'admin.group.members': 'Անդամներ',
	'admin.group.moderation': 'Մոդերացիա',
	'admin.group.shop': 'Միավորներ և խանութ',
	'admin.group.money': 'Ֆինանսներ',
	'admin.group.system': 'Համակարգ',
	'admin.nav.dashboard': 'Վահանակ',
	'admin.nav.hero': 'Գլխավոր էջ',
	'admin.nav.news': 'Նորություններ',
	'admin.nav.pages': 'Էջեր',
	'admin.nav.events': 'Միջոցառումներ',
	'admin.nav.media': 'Մեդիա',
	'admin.nav.users': 'Օգտատերեր',
	'admin.nav.exams': 'Քննություններ',
	'admin.nav.certificates': 'Վկայականներ',
	'admin.nav.staff': 'Մարզիչներ և մրցավարներ',
	'admin.nav.consents': 'Համաձայնություններ',
	'admin.nav.videos': 'Տեսանյութեր',
	'admin.nav.registrations': 'Գրանցումներ միջոցառումներին',
	'admin.nav.points': 'Միավորների մատյան',
	'admin.nav.pointRules': 'Միավորների կանոններ',
	'admin.nav.products': 'Ապրանքներ',
	'admin.nav.orders': 'Պատվերներ',
	'admin.nav.payments': 'Վճարումներ',
	'admin.nav.donations': 'Նվիրատվությունների նպատակներ',
	'admin.nav.settings': 'Կայքի կարգավորումներ',
	'admin.nav.audit': 'Գործողությունների մատյան',
	'admin.nav.roles': 'Ադմիններ և դերեր',

	'table.selectAll': 'Ընտրել բոլոր տողերը',
	'table.selectRow': 'Ընտրել տողը',
	'table.pagination': 'Էջեր',
	'table.prev': 'Նախորդ',
	'table.next': 'Հաջորդ',
	'table.pageOf': 'Էջ {page}՝ {pages}-ից',
	'filter.any': 'Ցանկացած',
	'filter.apply': 'Կիրառել',
	'filter.active': 'Ակտիվ ֆիլտրեր',
	'filter.remove': 'Հեռացնել «{filter}» ֆիլտրը',
	'filter.reset': 'Զրոյացնել բոլորը',
	'form.save': 'Պահպանել',
	'form.cancel': 'Չեղարկել',
	'form.unsaved': 'Կան չպահպանված փոփոխություններ։ Լքե՞լ էջը։',
	'confirm.comment': 'Մեկնաբանություն',
	'confirm.commentRequired': 'Մեկնաբանություն (պարտադիր)',
	'role.member': 'Անդամ',
	'role.editor': 'Խմբագիր',
	'role.moderator': 'Մոդերատոր',
	'role.admin': 'Ադմինիստրատոր',

	'mail.verify.subject': 'Հաստատեք ձեր էլ. փոստը',
	'mail.verify.text': 'Բացեք հղումը՝ էլ. փոստը հաստատելու համար՝ {url}',
	'mail.reset.subject': 'Գաղտնաբառի վերականգնում',
	'mail.reset.text': 'Բացեք հղումը՝ նոր գաղտնաբառ սահմանելու համար (գործում է 1 ժամ)՝ {url}'
};
