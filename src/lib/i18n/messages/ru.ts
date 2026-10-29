import type { Messages } from '../translate';
import { ruCabinet } from './ru-cabinet';
import { ruCabinetAvatar } from './ru-cabinet-avatar';
import { ruCabinetEvents } from './ru-cabinet-events';
import { ruCabinetPrivacy } from './ru-cabinet-privacy';
import { ruCabinetOrders } from './ru-cabinet-orders';
import { ruCabinetPoints } from './ru-cabinet-points';
import { ruCabinetProgress } from './ru-cabinet-progress';
import { ruCabinetVideos } from './ru-cabinet-videos';
import { ruCertificates } from './ru-certificates';
import { ruCertificatesAdmin } from './ru-certificates-admin';
import { ruConsents } from './ru-consents';
import { ruDashboard } from './ru-dashboard';
import { ruDonate } from './ru-donate';
import { ruEditor } from './ru-editor';
import { ruEvents } from './ru-events';
import { ruExamsAdmin } from './ru-exams-admin';
import { ruFest } from './ru-fest';
import { ruGoogle } from './ru-google';
import { ruHero } from './ru-hero';
import { ruHome } from './ru-home';
import { ruMedia } from './ru-media';
import { ruMembership } from './ru-membership';
import { ruNews } from './ru-news';
import { ruPages } from './ru-pages';
import { ruPayment } from './ru-payment';
import { ruPaymentsAdmin } from './ru-payments-admin';
import { ruPointRulesAdmin } from './ru-point-rules-admin';
import { ruPointsAdmin } from './ru-points-admin';
import { ruRegistrations } from './ru-registrations';
import { ruRegistrationsAdmin } from './ru-registrations-admin';
import { ruStaffAdmin } from './ru-staff-admin';
import { ruSystem } from './ru-system';
import { ruTeam } from './ru-team';
import { ruUsers } from './ru-users';
import { ruShop } from './ru-shop';
import { ruShopAdmin } from './ru-shop-admin';
import { ruTrainingAdmin } from './ru-training-admin';
import { ruVolunteerAdmin } from './ru-volunteer-admin';
import { ruVolunteerCards } from './ru-volunteer-cards';
import { ruVideosAdmin } from './ru-videos-admin';

export const ru: Partial<Messages> = {
	...ruUsers,
	...ruSystem,
	...ruMedia,
	...ruEditor,
	...ruPages,
	...ruNews,
	...ruEvents,
	...ruFest,
	...ruHero,
	...ruHome,
	...ruGoogle,
	...ruMembership,
	...ruDonate,
	...ruPayment,
	...ruPaymentsAdmin,
	...ruPointsAdmin,
	...ruPointRulesAdmin,
	...ruCabinet,
	...ruCabinetPoints,
	...ruCabinetProgress,
	...ruCabinetAvatar,
	...ruCabinetPrivacy,
	...ruCabinetEvents,
	...ruCabinetVideos,
	...ruCabinetOrders,
	...ruVideosAdmin,
	...ruDashboard,
	...ruShopAdmin,
	...ruTrainingAdmin,
	...ruVolunteerAdmin,
	...ruVolunteerCards,
	...ruShop,
	...ruConsents,
	...ruRegistrations,
	...ruRegistrationsAdmin,
	...ruCertificates,
	...ruTeam,
	...ruExamsAdmin,
	...ruCertificatesAdmin,
	...ruStaffAdmin,
	'site.description':
		'РЎРѕСЋР· РїР°СЂРєСѓСЂР° РђСЂРјРµРЅРёРё: СЃРѕР±С‹С‚РёСЏ, РЅРѕРІРѕСЃС‚Рё, С‡Р»РµРЅСЃС‚РІРѕ Рё Р°С‚С‚РµСЃС‚Р°С†РёСЏ.',
	'site.underConstruction': 'РЎР°Р№С‚ РІ СЂР°Р·СЂР°Р±РѕС‚РєРµ.',
	'common.close': 'Р—Р°РєСЂС‹С‚СЊ',

	'nav.skip': 'РџРµСЂРµР№С‚Рё Рє СЃРѕРґРµСЂР¶РёРјРѕРјСѓ',
	'nav.main': 'Р“Р»Р°РІРЅРѕРµ РјРµРЅСЋ',
	'nav.menu': 'РњРµРЅСЋ',
	'nav.events': 'РЎРѕР±С‹С‚РёСЏ',
	'nav.news': 'РќРѕРІРѕСЃС‚Рё',
	'nav.federation': 'Р¤РµРґРµСЂР°С†РёСЏ',
	'nav.shop': 'РњР°РіР°Р·РёРЅ',
	'nav.donate': 'РџРѕРґРґРµСЂР¶Р°С‚СЊ',
	'nav.login': 'Р’РѕР№С‚Рё',
	'nav.join': 'Р’СЃС‚СѓРїРёС‚СЊ',
	'nav.account': 'РђРєРєР°СѓРЅС‚',
	'nav.cabinet': 'РљР°Р±РёРЅРµС‚',
	'nav.admin': 'РђРґРјРёРЅРєР°',
	'nav.logout': 'Р’С‹Р№С‚Рё',
	'nav.language': 'РЇР·С‹Рє',

	'footer.contacts': 'РљРѕРЅС‚Р°РєС‚С‹',
	'footer.map': 'РџРѕРєР°Р·Р°С‚СЊ РЅР° РєР°СЂС‚Рµ',
	'footer.socials': 'РЎРѕС†СЃРµС‚Рё',
	'footer.requisites': 'Р РµРєРІРёР·РёС‚С‹',
	'footer.links': 'РРЅС„РѕСЂРјР°С†РёСЏ',
	'footer.about': 'Рћ С„РµРґРµСЂР°С†РёРё',
	'footer.rules': 'РџСЂР°РІРёР»Р°',
	'footer.privacy': 'РџРѕР»РёС‚РёРєР° РєРѕРЅС„РёРґРµРЅС†РёР°Р»СЊРЅРѕСЃС‚Рё',
	'footer.contactsPage': 'РљРѕРЅС‚Р°РєС‚С‹',
	'footer.offer': 'РџСѓР±Р»РёС‡РЅР°СЏ РѕС„РµСЂС‚Р°',
	'footer.refund': 'РџРѕР»РёС‚РёРєР° РІРѕР·РІСЂР°С‚Р°',

	'error.notFound.title': 'РЎС‚СЂР°РЅРёС†Р° РЅРµ РЅР°Р№РґРµРЅР°',
	'error.notFound.text': 'РўР°РєРѕР№ СЃС‚СЂР°РЅРёС†С‹ РЅРµС‚ РёР»Рё РѕРЅР° РїРµСЂРµРµС…Р°Р»Р°.',
	'error.forbidden.title': 'РќРµС‚ РґРѕСЃС‚СѓРїР°',
	'error.forbidden.text':
		'РЈ РІР°СЃ РЅРµС‚ РїСЂР°РІ, С‡С‚РѕР±С‹ РѕС‚РєСЂС‹С‚СЊ СЌС‚Сѓ СЃС‚СЂР°РЅРёС†Сѓ.',
	'error.request.title': 'РќРµ СѓРґР°Р»РѕСЃСЊ РѕС‚РєСЂС‹С‚СЊ СЃС‚СЂР°РЅРёС†Сѓ',
	'error.server.title': 'Р§С‚Рѕ-С‚Рѕ РїРѕС€Р»Рѕ РЅРµ С‚Р°Рє',
	'error.server.text':
		'РњС‹ СѓР¶Рµ СЂР°Р·Р±РёСЂР°РµРјСЃСЏ. РџРѕРїСЂРѕР±СѓР№С‚Рµ РµС‰С‘ СЂР°Р· С‡СѓС‚СЊ РїРѕР·Р¶Рµ.',
	'error.home': 'РќР° РіР»Р°РІРЅСѓСЋ',

	'auth.email': 'Email',
	'auth.password': 'РџР°СЂРѕР»СЊ',
	'auth.passwordHint': 'РћС‚ 8 РґРѕ 128 СЃРёРјРІРѕР»РѕРІ.',
	'auth.newPassword': 'РќРѕРІС‹Р№ РїР°СЂРѕР»СЊ',
	'auth.firstName': 'РРјСЏ',
	'auth.lastName': 'Р¤Р°РјРёР»РёСЏ',
	'auth.birthDate': 'Р”Р°С‚Р° СЂРѕР¶РґРµРЅРёСЏ',
	'auth.terms':
		'РџСЂРёРЅРёРјР°СЋ РїРѕР»РёС‚РёРєСѓ РєРѕРЅС„РёРґРµРЅС†РёР°Р»СЊРЅРѕСЃС‚Рё Рё РїСЂР°РІРёР»Р°',
	'auth.guardian.title': 'Р РѕРґРёС‚РµР»СЊ РёР»Рё РѕРїРµРєСѓРЅ',
	'auth.guardian.hint':
		'РћР±СЏР·Р°С‚РµР»СЊРЅРѕ РґР»СЏ СѓС‡Р°СЃС‚РЅРёРєРѕРІ РјР»Р°РґС€Рµ 18 Р»РµС‚.',
	'auth.guardianName': 'РРјСЏ СЂРѕРґРёС‚РµР»СЏ РёР»Рё РѕРїРµРєСѓРЅР°',
	'auth.guardianPhone': 'РўРµР»РµС„РѕРЅ СЂРѕРґРёС‚РµР»СЏ РёР»Рё РѕРїРµРєСѓРЅР°',
	'auth.guardianEmail': 'Email СЂРѕРґРёС‚РµР»СЏ РёР»Рё РѕРїРµРєСѓРЅР°',

	'auth.register.title': 'Р РµРіРёСЃС‚СЂР°С†РёСЏ',
	'auth.register.submit': 'Р—Р°СЂРµРіРёСЃС‚СЂРёСЂРѕРІР°С‚СЊСЃСЏ',
	'auth.register.haveAccount': 'РЈР¶Рµ РµСЃС‚СЊ Р°РєРєР°СѓРЅС‚? Р’РѕР№С‚Рё',
	'auth.login.title': 'Р’С…РѕРґ',
	'auth.login.submit': 'Р’РѕР№С‚Рё',
	'auth.login.forgot': 'Р—Р°Р±С‹Р»Рё РїР°СЂРѕР»СЊ?',
	'auth.login.noAccount': 'РќРµС‚ Р°РєРєР°СѓРЅС‚Р°? Р—Р°СЂРµРіРёСЃС‚СЂРёСЂРѕРІР°С‚СЊСЃСЏ',
	'auth.logout.title': 'Р’С‹С…РѕРґ',
	'auth.logout.text': 'Р—Р°РІРµСЂС€РёС‚СЊ СЃРµР°РЅСЃ РЅР° СЌС‚РѕРј СѓСЃС‚СЂРѕР№СЃС‚РІРµ?',
	'auth.logout.submit': 'Р’С‹Р№С‚Рё',
	'auth.forgot.title': 'РЎР±СЂРѕСЃ РїР°СЂРѕР»СЏ',
	'auth.forgot.text':
		'РЈРєР°Р¶РёС‚Рµ email вЂ” РїСЂРёС€Р»С‘Рј СЃСЃС‹Р»РєСѓ РґР»СЏ РЅРѕРІРѕРіРѕ РїР°СЂРѕР»СЏ.',
	'auth.forgot.submit': 'РћС‚РїСЂР°РІРёС‚СЊ СЃСЃС‹Р»РєСѓ',
	'auth.forgot.sent':
		'Р•СЃР»Рё СЌС‚РѕС‚ email Р·Р°СЂРµРіРёСЃС‚СЂРёСЂРѕРІР°РЅ, РјС‹ РѕС‚РїСЂР°РІРёР»Рё РЅР° РЅРµРіРѕ СЃСЃС‹Р»РєСѓ. РћРЅР° РґРµР№СЃС‚РІСѓРµС‚ 1 С‡Р°СЃ.',
	'auth.reset.title': 'РќРѕРІС‹Р№ РїР°СЂРѕР»СЊ',
	'auth.reset.submit': 'РЎРѕС…СЂР°РЅРёС‚СЊ РїР°СЂРѕР»СЊ',
	'auth.reset.done': 'РџР°СЂРѕР»СЊ РёР·РјРµРЅС‘РЅ. Р’РѕР№РґРёС‚Рµ СЃ РЅРѕРІС‹Рј РїР°СЂРѕР»РµРј.',
	'auth.verify.title': 'РџРѕРґС‚РІРµСЂР¶РґРµРЅРёРµ email',
	'auth.verify.done': 'Email РїРѕРґС‚РІРµСЂР¶РґС‘РЅ. РЎРїР°СЃРёР±Рѕ!',
	'auth.linkInvalid':
		'РЎСЃС‹Р»РєР° РЅРµРґРµР№СЃС‚РІРёС‚РµР»СЊРЅР° РёР»Рё СѓСЃС‚Р°СЂРµР»Р°. Р—Р°РїСЂРѕСЃРёС‚Рµ РЅРѕРІСѓСЋ.',

	'auth.error.required': 'Р—Р°РїРѕР»РЅРёС‚Рµ РїРѕР»Рµ.',
	'auth.error.tooLong': 'РЎР»РёС€РєРѕРј РґР»РёРЅРЅРѕ.',
	'auth.error.email': 'Р’РІРµРґРёС‚Рµ РєРѕСЂСЂРµРєС‚РЅС‹Р№ email.',
	'auth.error.passwordLength': 'РџР°СЂРѕР»СЊ вЂ” РѕС‚ 8 РґРѕ 128 СЃРёРјРІРѕР»РѕРІ.',
	'auth.error.birthDate': 'Р’РІРµРґРёС‚Рµ РєРѕСЂСЂРµРєС‚РЅСѓСЋ РґР°С‚Сѓ СЂРѕР¶РґРµРЅРёСЏ.',
	'auth.error.terms':
		'РќСѓР¶РЅРѕ РїСЂРёРЅСЏС‚СЊ РїРѕР»РёС‚РёРєСѓ РєРѕРЅС„РёРґРµРЅС†РёР°Р»СЊРЅРѕСЃС‚Рё Рё РїСЂР°РІРёР»Р°.',
	'auth.error.phone': 'Р’РІРµРґРёС‚Рµ РєРѕСЂСЂРµРєС‚РЅС‹Р№ РЅРѕРјРµСЂ С‚РµР»РµС„РѕРЅР°.',
	'auth.error.invalid': 'РќРµРІРµСЂРЅС‹Р№ email РёР»Рё РїР°СЂРѕР»СЊ.',
	'auth.error.blocked':
		'РђРєРєР°СѓРЅС‚ Р·Р°Р±Р»РѕРєРёСЂРѕРІР°РЅ. РЎРІСЏР¶РёС‚РµСЃСЊ СЃ С„РµРґРµСЂР°С†РёРµР№.',
	'auth.error.limited':
		'РЎР»РёС€РєРѕРј РјРЅРѕРіРѕ РїРѕРїС‹С‚РѕРє. РџРѕРїСЂРѕР±СѓР№С‚Рµ РїРѕР·Р¶Рµ.',
	'auth.error.exists': 'РђРєРєР°СѓРЅС‚ СЃ С‚Р°РєРёРј email СѓР¶Рµ РµСЃС‚СЊ.',

	'admin.title': 'РђРґРјРёРЅ-РїР°РЅРµР»СЊ',
	'admin.sections': 'Р Р°Р·РґРµР»С‹ Р°РґРјРёРЅРєРё',
	'admin.breadcrumbs': 'РќР°РІРёРіР°С†РёРѕРЅРЅР°СЏ С†РµРїРѕС‡РєР°',
	'admin.toSite': 'РћС‚РєСЂС‹С‚СЊ СЃР°Р№С‚',
	'admin.group.overview': 'РћР±Р·РѕСЂ',
	'admin.group.content': 'РљРѕРЅС‚РµРЅС‚',
	'admin.group.members': 'РЈС‡Р°СЃС‚РЅРёРєРё',
	'admin.group.moderation': 'РњРѕРґРµСЂР°С†РёСЏ',
	'admin.group.shop': 'Р‘Р°Р»Р»С‹ Рё РјР°РіР°Р·РёРЅ',
	'admin.group.money': 'Р”РµРЅСЊРіРё',
	'admin.group.system': 'РЎРёСЃС‚РµРјР°',
	'admin.nav.dashboard': 'Р”Р°С€Р±РѕСЂРґ',
	'admin.nav.hero': 'Р“Р»Р°РІРЅР°СЏ',
	'admin.nav.news': 'РќРѕРІРѕСЃС‚Рё',
	'admin.nav.pages': 'РЎС‚СЂР°РЅРёС†С‹',
	'admin.nav.events': 'РЎРѕР±С‹С‚РёСЏ',
	'admin.nav.media': 'РњРµРґРёР°',
	'admin.nav.users': 'РџРѕР»СЊР·РѕРІР°С‚РµР»Рё',
	'admin.nav.exams': 'Р­РєР·Р°РјРµРЅС‹',
	'admin.nav.certificates': 'РЎРµСЂС‚РёС„РёРєР°С‚С‹',
	'admin.nav.staff': 'РўСЂРµРЅРµСЂС‹ Рё СЃСѓРґСЊРё',
	'admin.nav.consents': 'РЎРѕРіР»Р°СЃРёСЏ',
	'admin.nav.videos': 'Р’РёРґРµРѕ',
	'admin.nav.registrations': 'Р РµРіРёСЃС‚СЂР°С†РёРё РЅР° СЃРѕР±С‹С‚РёСЏ',
	'admin.nav.points': 'Р–СѓСЂРЅР°Р» Р±Р°Р»Р»РѕРІ',
	'admin.nav.pointRules': 'РџСЂР°РІРёР»Р° Р±Р°Р»Р»РѕРІ',
	'admin.nav.products': 'РўРѕРІР°СЂС‹',
	'admin.nav.orders': 'Р—Р°РєР°Р·С‹',
	'admin.nav.payments': 'РџР»Р°С‚РµР¶Рё',
	'admin.nav.donations': 'РќР°Р·РЅР°С‡РµРЅРёСЏ РґРѕРЅР°С‚РѕРІ',
	'admin.nav.settings': 'РќР°СЃС‚СЂРѕР№РєРё СЃР°Р№С‚Р°',
	'admin.nav.audit': 'Р–СѓСЂРЅР°Р» РґРµР№СЃС‚РІРёР№',
	'admin.nav.roles': 'РђРґРјРёРЅС‹ Рё СЂРѕР»Рё',

	'table.selectAll': 'Р’С‹Р±СЂР°С‚СЊ РІСЃРµ СЃС‚СЂРѕРєРё',
	'table.selectRow': 'Р’С‹Р±СЂР°С‚СЊ СЃС‚СЂРѕРєСѓ',
	'table.pagination': 'РЎС‚СЂР°РЅРёС†С‹',
	'table.prev': 'РќР°Р·Р°Рґ',
	'table.next': 'Р’РїРµСЂС‘Рґ',
	'table.pageOf': 'РЎС‚СЂР°РЅРёС†Р° {page} РёР· {pages}',
	'filter.any': 'Р›СЋР±РѕР№',
	'filter.apply': 'РџСЂРёРјРµРЅРёС‚СЊ',
	'filter.active': 'РђРєС‚РёРІРЅС‹Рµ С„РёР»СЊС‚СЂС‹',
	'filter.remove': 'РЈР±СЂР°С‚СЊ С„РёР»СЊС‚СЂ {filter}',
	'filter.reset': 'РЎР±СЂРѕСЃРёС‚СЊ РІСЃРµ',
	'form.save': 'РЎРѕС…СЂР°РЅРёС‚СЊ',
	'form.cancel': 'РћС‚РјРµРЅР°',
	'form.unsaved':
		'Р•СЃС‚СЊ РЅРµСЃРѕС…СЂР°РЅС‘РЅРЅС‹Рµ РёР·РјРµРЅРµРЅРёСЏ. РЈР№С‚Рё СЃРѕ СЃС‚СЂР°РЅРёС†С‹?',
	'confirm.comment': 'РљРѕРјРјРµРЅС‚Р°СЂРёР№',
	'confirm.commentRequired': 'РљРѕРјРјРµРЅС‚Р°СЂРёР№ (РѕР±СЏР·Р°С‚РµР»СЊРЅРѕ)',
	'role.member': 'РЈС‡Р°СЃС‚РЅРёРє',
	'role.editor': 'Р РµРґР°РєС‚РѕСЂ',
	'role.moderator': 'РњРѕРґРµСЂР°С‚РѕСЂ',
	'role.admin': 'РђРґРјРёРЅРёСЃС‚СЂР°С‚РѕСЂ',

	'mail.verify.subject': 'РџРѕРґС‚РІРµСЂРґРёС‚Рµ email',
	'mail.verify.text':
		'РћС‚РєСЂРѕР№С‚Рµ СЃСЃС‹Р»РєСѓ, С‡С‚РѕР±С‹ РїРѕРґС‚РІРµСЂРґРёС‚СЊ email: {url}',
	'mail.reset.subject': 'РЎР±СЂРѕСЃ РїР°СЂРѕР»СЏ',
	'mail.reset.text':
		'РћС‚РєСЂРѕР№С‚Рµ СЃСЃС‹Р»РєСѓ, С‡С‚РѕР±С‹ Р·Р°РґР°С‚СЊ РЅРѕРІС‹Р№ РїР°СЂРѕР»СЊ (РґРµР№СЃС‚РІСѓРµС‚ 1 С‡Р°СЃ): {url}'
};
