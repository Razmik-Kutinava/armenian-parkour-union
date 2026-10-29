import type { Messages } from '../translate';
import { hyCabinet } from './hy-cabinet';
import { hyCabinetAvatar } from './hy-cabinet-avatar';
import { hyCabinetEvents } from './hy-cabinet-events';
import { hyCabinetPrivacy } from './hy-cabinet-privacy';
import { hyCabinetOrders } from './hy-cabinet-orders';
import { hyCabinetPoints } from './hy-cabinet-points';
import { hyCabinetProgress } from './hy-cabinet-progress';
import { hyCabinetVideos } from './hy-cabinet-videos';
import { hyCertificates } from './hy-certificates';
import { hyCertificatesAdmin } from './hy-certificates-admin';
import { hyConsents } from './hy-consents';
import { hyDashboard } from './hy-dashboard';
import { hyDonate } from './hy-donate';
import { hyEditor } from './hy-editor';
import { hyEvents } from './hy-events';
import { hyExamsAdmin } from './hy-exams-admin';
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
import { hyStaffAdmin } from './hy-staff-admin';
import { hySystem } from './hy-system';
import { hyTeam } from './hy-team';
import { hyUsers } from './hy-users';
import { hyShop } from './hy-shop';
import { hyShopAdmin } from './hy-shop-admin';
import { hyTrainingAdmin } from './hy-training-admin';
import { hyVolunteerAdmin } from './hy-volunteer-admin';
import { hyVolunteerCards } from './hy-volunteer-cards';
import { hyVideosAdmin } from './hy-videos-admin';

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
	...hyCabinetProgress,
	...hyCabinetAvatar,
	...hyCabinetPrivacy,
	...hyCabinetEvents,
	...hyCabinetVideos,
	...hyCabinetOrders,
	...hyVideosAdmin,
	...hyDashboard,
	...hyShopAdmin,
	...hyTrainingAdmin,
	...hyVolunteerAdmin,
	...hyVolunteerCards,
	...hyShop,
	...hyConsents,
	...hyRegistrations,
	...hyRegistrationsAdmin,
	...hyCertificates,
	...hyTeam,
	...hyExamsAdmin,
	...hyCertificatesAdmin,
	...hyStaffAdmin,
	'site.description':
		'Armenian Parkour UnionХќ ХґХ«Х»ХёЦЃХЎХјХёЦ‚ХґХ¶ХҐЦЂ, Х¶ХёЦЂХёЦ‚Х©ХµХёЦ‚Х¶Х¶ХҐЦЂ, ХЎХ¶Х¤ХЎХґХЎХЇЦЃХёЦ‚Х©ХµХёЦ‚Х¶ Ц‡ ХЎХїХҐХЅХїХЎХѕХёЦЂХёЦ‚ХґЦ‰',
	'site.underConstruction': 'ФїХЎХµЦ„ХЁ ХґХ·ХЎХЇХґХЎХ¶ ЦѓХёЦ‚Х¬ХёЦ‚Хґ Х§Ц‰',
	'common.close': 'Х“ХЎХЇХҐХ¬',

	'nav.skip': 'Ф±Х¶ЦЃХ¶ХҐХ¬ ХўХёХѕХЎХ¶Х¤ХЎХЇХёЦ‚Х©ХµХЎХ¶ХЁ',
	'nav.main': 'ФіХ¬Х­ХЎХѕХёЦЂ ХЁХ¶ХїЦЂХЎЦЃХЎХ¶ХЇ',
	'nav.menu': 'ФёХ¶ХїЦЂХЎЦЃХЎХ¶ХЇ',
	'nav.events': 'Х„Х«Х»ХёЦЃХЎХјХёЦ‚ХґХ¶ХҐЦЂ',
	'nav.news': 'Х†ХёЦЂХёЦ‚Х©ХµХёЦ‚Х¶Х¶ХҐЦЂ',
	'nav.federation': 'Х–ХҐХ¤ХҐЦЂХЎЦЃХ«ХЎ',
	'nav.shop': 'ФЅХЎХ¶ХёЦ‚Х©',
	'nav.donate': 'Ф±Х»ХЎХЇЦЃХҐХ¬',
	'nav.login': 'Х„ХёЦ‚ХїЦ„',
	'nav.join': 'Х„Х«ХЎХ¶ХЎХ¬',
	'nav.account': 'ХЂХЎХ·Х«Хѕ',
	'nav.cabinet': 'Ф±Х¶Х±Х¶ХЎХЇХЎХ¶ Х§Х»',
	'nav.admin': 'Ф±Х¤ХґХ«Х¶Х«ХЅХїЦЂХЎЦЃХ«ХЎ',
	'nav.logout': 'ФµХ¬Ц„',
	'nav.language': 'ФјХҐХ¦ХёЦ‚',

	'footer.contacts': 'ФїХёХ¶ХїХЎХЇХїХ¶ХҐЦЂ',
	'footer.map': 'Х‘ХёЦ‚ХµЦЃ ХїХЎХ¬ Ц„ХЎЦЂХїХҐХ¦Х« ХѕЦЂХЎ',
	'footer.socials': 'ХЌХёЦЃХ«ХЎХ¬ХЎХЇХЎХ¶ ЦЃХЎХ¶ЦЃХҐЦЂ',
	'footer.requisites': 'ХЋХЎХѕХҐЦЂХЎХєХЎХµХґХЎХ¶Х¶ХҐЦЂ',
	'footer.links': 'ХЏХҐХІХҐХЇХЎХїХѕХёЦ‚Х©ХµХёЦ‚Х¶',
	'footer.about': 'Х–ХҐХ¤ХҐЦЂХЎЦЃХ«ХЎХµХ« ХґХЎХЅХ«Х¶',
	'footer.rules': 'ФїХЎХ¶ХёХ¶Х¶ХҐЦЂ',
	'footer.privacy': 'ФіХЎХІХїХ¶Х«ХёЦ‚Х©ХµХЎХ¶ Ц„ХЎХІХЎЦ„ХЎХЇХЎХ¶ХёЦ‚Х©ХµХёЦ‚Х¶',
	'footer.contactsPage': 'ФїХёХ¶ХїХЎХЇХїХ¶ХҐЦЂ',
	'footer.offer': 'ХЂХЎХ¶ЦЂХЎХµХ«Х¶ Ц…Ц†ХҐЦЂХїХЎ',
	'footer.refund': 'ХЋХҐЦЂХЎХ¤ХЎЦЂХ±Х« Ц„ХЎХІХЎЦ„ХЎХЇХЎХ¶ХёЦ‚Х©ХµХёЦ‚Х¶',

	'error.notFound.title': 'Ф·Х»ХЁ Х№Х« ХЈХїХ¶ХѕХҐХ¬',
	'error.notFound.text':
		'Ф±ХµХЅ Х§Х»ХЁ ХЈХёХµХёЦ‚Х©ХµХёЦ‚Х¶ Х№ХёЦ‚Х¶Х« ХЇХЎХґ ХїХҐХІХЎЦѓХёХ­ХѕХҐХ¬ Х§Ц‰',
	'error.forbidden.title': 'Х„ХёЦ‚ХїЦ„Х¶ ХЎЦЂХЈХҐХ¬ХѕХЎХ® Х§',
	'error.forbidden.text': 'ФґХёЦ‚Ц„ ХЎХµХЅ Х§Х»ХЁ ХўХЎЦЃХҐХ¬ХёЦ‚ Х«ЦЂХЎХѕХёЦ‚Х¶Ц„ Х№ХёЦ‚Х¶ХҐЦ„Ц‰',
	'error.request.title': 'Х‰Х°ХЎХ»ХёХІХѕХҐЦЃ ХўХЎЦЃХҐХ¬ Х§Х»ХЁ',
	'error.server.title': 'Ф»Х¶Х№-ХёЦЂ ХўХЎХ¶ ХЅХ­ХЎХ¬ ХЁХ¶Х©ХЎЦЃХЎХѕ',
	'error.server.text':
		'Х„ХҐХ¶Ц„ ХЎЦЂХ¤ХҐХ¶ Х¦ХўХЎХІХѕХёЦ‚Хґ ХҐХ¶Ц„ Х¤ЦЂХЎХ¶ХёХѕЦ‰ ФЅХ¶Х¤ЦЂХёЦ‚Хґ ХҐХ¶Ц„ ЦѓХёЦЂХ±ХҐХ¬ ХґХ« ЦѓХёЦ„ЦЂ ХёЦ‚Х·Ц‰',
	'error.home': 'ФіХ¬Х­ХЎХѕХёЦЂ Х§Х»',

	'auth.email': 'Ф·Х¬. ЦѓХёХЅХї',
	'auth.password': 'ФіХЎХІХїХ¶ХЎХўХЎХј',
	'auth.passwordHint': '8-Х«ЦЃ 128 Х¶Х«Х·Ц‰',
	'auth.newPassword': 'Х†ХёЦЂ ХЈХЎХІХїХ¶ХЎХўХЎХј',
	'auth.firstName': 'Ф±Х¶ХёЦ‚Х¶',
	'auth.lastName': 'Ф±Х¦ХЈХЎХ¶ХёЦ‚Х¶',
	'auth.birthDate': 'ФѕХ¶Х¶Х¤ХµХЎХ¶ ХЎХґХЅХЎХ©Х«Хѕ',
	'auth.terms':
		'ФёХ¶Х¤ХёЦ‚Х¶ХёЦ‚Хґ ХҐХґ ХЈХЎХІХїХ¶Х«ХёЦ‚Х©ХµХЎХ¶ Ц„ХЎХІХЎЦ„ХЎХЇХЎХ¶ХёЦ‚Х©ХµХёЦ‚Х¶ХЁ Ц‡ ХЇХЎХ¶ХёХ¶Х¶ХҐЦЂХЁ',
	'auth.guardian.title': 'ФѕХ¶ХёХІ ХЇХЎХґ Ц…ЦЂХ«Х¶ХЎХЇХЎХ¶ Х¶ХҐЦЂХЇХЎХµХЎЦЃХёЦ‚ЦЃХ«Х№',
	'auth.guardian.hint':
		'ХЉХЎЦЂХїХЎХ¤Х«ЦЂ Х§ ХґХ«Х¶Х№Ц‡ 18 ХїХЎЦЂХҐХЇХЎХ¶ ХґХЎХЅХ¶ХЎХЇХ«ЦЃХ¶ХҐЦЂХ« Х°ХЎХґХЎЦЂЦ‰',
	'auth.guardianName': 'ФѕХ¶ХёХІХ« ХЇХЎХґ Ц…ЦЂХ«Х¶ХЎХЇХЎХ¶ Х¶ХҐЦЂХЇХЎХµХЎЦЃХёЦ‚ЦЃХ№Х« ХЎХ¶ХёЦ‚Х¶ХЁ',
	'auth.guardianPhone':
		'ФѕХ¶ХёХІХ« ХЇХЎХґ Ц…ЦЂХ«Х¶ХЎХЇХЎХ¶ Х¶ХҐЦЂХЇХЎХµХЎЦЃХёЦ‚ЦЃХ№Х« Х°ХҐХјХЎХ­ХёХЅХЁ',
	'auth.guardianEmail':
		'ФѕХ¶ХёХІХ« ХЇХЎХґ Ц…ЦЂХ«Х¶ХЎХЇХЎХ¶ Х¶ХҐЦЂХЇХЎХµХЎЦЃХёЦ‚ЦЃХ№Х« Х§Х¬. ЦѓХёХЅХїХЁ',

	'auth.register.title': 'ФіЦЂХЎХ¶ЦЃХёЦ‚Хґ',
	'auth.register.submit': 'ФіЦЂХЎХ¶ЦЃХѕХҐХ¬',
	'auth.register.haveAccount': 'Ф±ЦЂХ¤ХҐХ¶ ХёЦ‚Х¶ХҐХћЦ„ Х°ХЎХ·Х«ХѕЦ‰ Х„ХёЦ‚ХїЦ„ ХЈХёЦЂХ®ХҐЦ„',
	'auth.login.title': 'Х„ХёЦ‚ХїЦ„',
	'auth.login.submit': 'Х„ХёЦ‚ХїЦ„ ХЈХёЦЂХ®ХҐХ¬',
	'auth.login.forgot': 'Х„ХёХјХЎЦЃХҐХћХ¬ ХҐЦ„ ХЈХЎХІХїХ¶ХЎХўХЎХјХЁ',
	'auth.login.noAccount': 'ХЂХЎХ·Х«Хѕ Х№ХёЦ‚Х¶ХҐХћЦ„Ц‰ ФіЦЂХЎХ¶ЦЃХѕХҐЦ„',
	'auth.logout.title': 'ФµХ¬Ц„',
	'auth.logout.text': 'Ф±ХѕХЎЦЂХїХҐХћХ¬ ХЎХ·Х­ХЎХїХЎХ·ЦЂХ»ХЎХ¶Х¶ ХЎХµХЅ ХЅХЎЦЂЦ„ХёЦ‚ХґЦ‰',
	'auth.logout.submit': 'ФµХ¬Ц„',
	'auth.forgot.title': 'ФіХЎХІХїХ¶ХЎХўХЎХјХ« ХѕХҐЦЂХЎХЇХЎХ¶ХЈХ¶ХёЦ‚Хґ',
	'auth.forgot.text':
		'Х†Х·ХҐЦ„ Х±ХҐЦЂ Х§Х¬. ЦѓХёХЅХїХЁ, Ц‡ ХґХҐХ¶Ц„ ХЇХёЦ‚ХІХЎЦЂХЇХҐХ¶Ц„ Х¶ХёЦЂ ХЈХЎХІХїХ¶ХЎХўХЎХј ХЅХЎХ°ХґХЎХ¶ХҐХ¬ХёЦ‚ Х°ХІХёЦ‚ХґХЁЦ‰',
	'auth.forgot.submit': 'Х€Ц‚ХІХЎЦЂХЇХҐХ¬ Х°ХІХёЦ‚ХґХЁ',
	'auth.forgot.sent':
		'ФµХ©ХҐ ХЎХµХЅ Х§Х¬. ЦѓХёХЅХїХЁ ХЈЦЂХЎХ¶ЦЃХѕХЎХ® Х§, ХґХҐХ¶Ц„ Х¤ЦЂХЎХ¶ Х°ХІХёЦ‚Хґ ХҐХ¶Ц„ ХёЦ‚ХІХЎЦЂХЇХҐХ¬Ц‰ Ф±ХµХ¶ ХЈХёЦЂХ®ХёЦ‚Хґ Х§ 1 ХЄХЎХґЦ‰',
	'auth.reset.title': 'Х†ХёЦЂ ХЈХЎХІХїХ¶ХЎХўХЎХј',
	'auth.reset.submit': 'ХЉХЎХ°ХєХЎХ¶ХҐХ¬ ХЈХЎХІХїХ¶ХЎХўХЎХјХЁ',
	'auth.reset.done':
		'ФіХЎХІХїХ¶ХЎХўХЎХјХЁ ЦѓХёХ­ХѕХЎХ® Х§Ц‰ Х„ХёЦ‚ХїЦ„ ХЈХёЦЂХ®ХҐЦ„ Х¶ХёЦЂ ХЈХЎХІХїХ¶ХЎХўХЎХјХёХѕЦ‰',
	'auth.verify.title': 'Ф·Х¬. ЦѓХёХЅХїХ« Х°ХЎХЅХїХЎХїХёЦ‚Хґ',
	'auth.verify.done': 'Ф·Х¬. ЦѓХёХЅХїХЁ Х°ХЎХЅХїХЎХїХѕХЎХ® Х§Ц‰ Х‡Х¶ХёЦЂХ°ХЎХЇХЎХ¬ХёЦ‚Х©ХµХёЦ‚Х¶Ц‰',
	'auth.linkInvalid':
		'ХЂХІХёЦ‚ХґХ¶ ХЎХ¶ХѕХЎХѕХҐЦЂ Х§ ХЇХЎХґ ХЄХЎХґХЇХҐХїХЎХ¶ЦЃЦ‰ ХЉХЎХ°ХЎХ¶Х»ХҐЦ„ Х¶ХёЦЂХЁЦ‰',

	'auth.error.required': 'ФјЦЂХЎЦЃЦЂХҐЦ„ Х¤ХЎХ·ХїХЁЦ‰',
	'auth.error.tooLong': 'Х‰ХЎЦѓХЎХ¦ХЎХ¶ЦЃ ХҐЦЂХЇХЎЦЂ Х§Ц‰',
	'auth.error.email': 'Х„ХёЦ‚ХїЦ„ХЎХЈЦЂХҐЦ„ ХіХ«Х·Хї Х§Х¬. ЦѓХёХЅХїЦ‰',
	'auth.error.passwordLength': 'ФіХЎХІХїХ¶ХЎХўХЎХјХЁ ХєХҐХїЦ„ Х§ Х¬Х«Х¶Х« 8-Х«ЦЃ 128 Х¶Х«Х·Ц‰',
	'auth.error.birthDate': 'Х„ХёЦ‚ХїЦ„ХЎХЈЦЂХҐЦ„ ХіХ«Х·Хї Х®Х¶Х¶Х¤ХµХЎХ¶ ХЎХґХЅХЎХ©Х«ХѕЦ‰',
	'auth.error.terms':
		'Ф±Х¶Х°ЦЂХЎХЄХҐХ·Хї Х§ ХЁХ¶Х¤ХёЦ‚Х¶ХҐХ¬ ХЈХЎХІХїХ¶Х«ХёЦ‚Х©ХµХЎХ¶ Ц„ХЎХІХЎЦ„ХЎХЇХЎХ¶ХёЦ‚Х©ХµХёЦ‚Х¶ХЁ Ц‡ ХЇХЎХ¶ХёХ¶Х¶ХҐЦЂХЁЦ‰',
	'auth.error.phone': 'Х„ХёЦ‚ХїЦ„ХЎХЈЦЂХҐЦ„ ХіХ«Х·Хї Х°ХҐХјХЎХ­ХёХЅХЎХ°ХЎХґХЎЦЂЦ‰',
	'auth.error.invalid': 'ХЌХ­ХЎХ¬ Х§Х¬. ЦѓХёХЅХї ХЇХЎХґ ХЈХЎХІХїХ¶ХЎХўХЎХјЦ‰',
	'auth.error.blocked':
		'ХЂХЎХ·Х«ХѕХ¶ ХЎЦЂХЈХҐХ¬ХЎЦѓХЎХЇХѕХЎХ® Х§Ц‰ ФїХЎХєХѕХҐЦ„ Ц†ХҐХ¤ХҐЦЂХЎЦЃХ«ХЎХµХ« Х°ХҐХїЦ‰',
	'auth.error.limited': 'Х‰ХЎЦѓХЎХ¦ХЎХ¶ЦЃ Х·ХЎХї ЦѓХёЦЂХ±ХҐЦЂЦ‰ Х“ХёЦЂХ±ХҐЦ„ ХЎХѕХҐХ¬Х« ХёЦ‚Х·Ц‰',
	'auth.error.exists': 'Ф±ХµХЅ Х§Х¬. ЦѓХёХЅХїХёХѕ Х°ХЎХ·Х«Хѕ ХЎЦЂХ¤ХҐХ¶ ХЇХЎЦ‰',

	'admin.title': 'Ф±Х¤ХґХ«Х¶Х«ХЅХїЦЂХЎХїХ«Хѕ ХѕХЎХ°ХЎХ¶ХЎХЇ',
	'admin.sections': 'Ф±Х¤ХґХ«Х¶Х«ХЅХїЦЂХЎЦЃХ«ХЎХµХ« ХўХЎХЄХ«Х¶Х¶ХҐЦЂ',
	'admin.breadcrumbs': 'Х†ХЎХѕХ«ХЈХЎЦЃХ«ХёХ¶ Х·ХІХ©ХЎ',
	'admin.toSite': 'ФІХЎЦЃХҐХ¬ ХЇХЎХµЦ„ХЁ',
	'admin.group.overview': 'Ф±ХЇХ¶ХЎЦЂХЇ',
	'admin.group.content': 'ФІХёХѕХЎХ¶Х¤ХЎХЇХёЦ‚Х©ХµХёЦ‚Х¶',
	'admin.group.members': 'Ф±Х¶Х¤ХЎХґХ¶ХҐЦЂ',
	'admin.group.moderation': 'Х„ХёХ¤ХҐЦЂХЎЦЃХ«ХЎ',
	'admin.group.shop': 'Х„Х«ХЎХѕХёЦЂХ¶ХҐЦЂ Ц‡ Х­ХЎХ¶ХёЦ‚Х©',
	'admin.group.money': 'Х–Х«Х¶ХЎХ¶ХЅХ¶ХҐЦЂ',
	'admin.group.system': 'ХЂХЎХґХЎХЇХЎЦЂХЈ',
	'admin.nav.dashboard': 'ХЋХЎХ°ХЎХ¶ХЎХЇ',
	'admin.nav.hero': 'ФіХ¬Х­ХЎХѕХёЦЂ Х§Х»',
	'admin.nav.news': 'Х†ХёЦЂХёЦ‚Х©ХµХёЦ‚Х¶Х¶ХҐЦЂ',
	'admin.nav.pages': 'Ф·Х»ХҐЦЂ',
	'admin.nav.events': 'Х„Х«Х»ХёЦЃХЎХјХёЦ‚ХґХ¶ХҐЦЂ',
	'admin.nav.media': 'Х„ХҐХ¤Х«ХЎ',
	'admin.nav.users': 'Х•ХЈХїХЎХїХҐЦЂХҐЦЂ',
	'admin.nav.exams': 'Х”Х¶Х¶ХёЦ‚Х©ХµХёЦ‚Х¶Х¶ХҐЦЂ',
	'admin.nav.certificates': 'ХЋХЇХЎХµХЎХЇХЎХ¶Х¶ХҐЦЂ',
	'admin.nav.staff': 'Х„ХЎЦЂХ¦Х«Х№Х¶ХҐЦЂ Ц‡ ХґЦЂЦЃХЎХѕХЎЦЂХ¶ХҐЦЂ',
	'admin.nav.consents': 'ХЂХЎХґХЎХ±ХЎХµХ¶ХёЦ‚Х©ХµХёЦ‚Х¶Х¶ХҐЦЂ',
	'admin.nav.videos': 'ХЏХҐХЅХЎХ¶ХµХёЦ‚Х©ХҐЦЂ',
	'admin.nav.registrations': 'ФіЦЂХЎХ¶ЦЃХёЦ‚ХґХ¶ХҐЦЂ ХґХ«Х»ХёЦЃХЎХјХёЦ‚ХґХ¶ХҐЦЂХ«Х¶',
	'admin.nav.points': 'Х„Х«ХЎХѕХёЦЂХ¶ХҐЦЂХ« ХґХЎХїХµХЎХ¶',
	'admin.nav.pointRules': 'Х„Х«ХЎХѕХёЦЂХ¶ХҐЦЂХ« ХЇХЎХ¶ХёХ¶Х¶ХҐЦЂ',
	'admin.nav.products': 'Ф±ХєЦЂХЎХ¶Ц„Х¶ХҐЦЂ',
	'admin.nav.orders': 'ХЉХЎХїХѕХҐЦЂХ¶ХҐЦЂ',
	'admin.nav.payments': 'ХЋХіХЎЦЂХёЦ‚ХґХ¶ХҐЦЂ',
	'admin.nav.donations': 'Х†ХѕХ«ЦЂХЎХїХѕХёЦ‚Х©ХµХёЦ‚Х¶Х¶ХҐЦЂХ« Х¶ХєХЎХїХЎХЇХ¶ХҐЦЂ',
	'admin.nav.settings': 'ФїХЎХµЦ„Х« ХЇХЎЦЂХЈХЎХѕХёЦЂХёЦ‚ХґХ¶ХҐЦЂ',
	'admin.nav.audit': 'ФіХёЦЂХ®ХёХІХёЦ‚Х©ХµХёЦ‚Х¶Х¶ХҐЦЂХ« ХґХЎХїХµХЎХ¶',
	'admin.nav.roles': 'Ф±Х¤ХґХ«Х¶Х¶ХҐЦЂ Ц‡ Х¤ХҐЦЂХҐЦЂ',

	'table.selectAll': 'ФёХ¶ХїЦЂХҐХ¬ ХўХёХ¬ХёЦЂ ХїХёХІХҐЦЂХЁ',
	'table.selectRow': 'ФёХ¶ХїЦЂХҐХ¬ ХїХёХІХЁ',
	'table.pagination': 'Ф·Х»ХҐЦЂ',
	'table.prev': 'Х†ХЎХ­ХёЦЂХ¤',
	'table.next': 'ХЂХЎХ»ХёЦЂХ¤',
	'table.pageOf': 'Ф·Х» {page}Хќ {pages}-Х«ЦЃ',
	'filter.any': 'Х‘ХЎХ¶ХЇХЎЦЃХЎХ®',
	'filter.apply': 'ФїХ«ЦЂХЎХјХҐХ¬',
	'filter.active': 'Ф±ХЇХїХ«Хѕ Ц†Х«Х¬ХїЦЂХҐЦЂ',
	'filter.remove': 'ХЂХҐХјХЎЦЃХ¶ХҐХ¬ В«{filter}В» Ц†Х«Х¬ХїЦЂХЁ',
	'filter.reset': 'Ф¶ЦЂХёХµХЎЦЃХ¶ХҐХ¬ ХўХёХ¬ХёЦЂХЁ',
	'form.save': 'ХЉХЎХ°ХєХЎХ¶ХҐХ¬',
	'form.cancel': 'Х‰ХҐХІХЎЦЂХЇХҐХ¬',
	'form.unsaved':
		'ФїХЎХ¶ Х№ХєХЎХ°ХєХЎХ¶ХѕХЎХ® ЦѓХёЦѓХёХ­ХёЦ‚Х©ХµХёЦ‚Х¶Х¶ХҐЦЂЦ‰ ФјЦ„ХҐХћХ¬ Х§Х»ХЁЦ‰',
	'confirm.comment': 'Х„ХҐХЇХ¶ХЎХўХЎХ¶ХёЦ‚Х©ХµХёЦ‚Х¶',
	'confirm.commentRequired': 'Х„ХҐХЇХ¶ХЎХўХЎХ¶ХёЦ‚Х©ХµХёЦ‚Х¶ (ХєХЎЦЂХїХЎХ¤Х«ЦЂ)',
	'role.member': 'Ф±Х¶Х¤ХЎХґ',
	'role.editor': 'ФЅХґХўХЎХЈХ«ЦЂ',
	'role.moderator': 'Х„ХёХ¤ХҐЦЂХЎХїХёЦЂ',
	'role.admin': 'Ф±Х¤ХґХ«Х¶Х«ХЅХїЦЂХЎХїХёЦЂ',

	'mail.verify.subject': 'ХЂХЎХЅХїХЎХїХҐЦ„ Х±ХҐЦЂ Х§Х¬. ЦѓХёХЅХїХЁ',
	'mail.verify.text':
		'ФІХЎЦЃХҐЦ„ Х°ХІХёЦ‚ХґХЁХќ Х§Х¬. ЦѓХёХЅХїХЁ Х°ХЎХЅХїХЎХїХҐХ¬ХёЦ‚ Х°ХЎХґХЎЦЂХќ {url}',
	'mail.reset.subject': 'ФіХЎХІХїХ¶ХЎХўХЎХјХ« ХѕХҐЦЂХЎХЇХЎХ¶ХЈХ¶ХёЦ‚Хґ',
	'mail.reset.text':
		'ФІХЎЦЃХҐЦ„ Х°ХІХёЦ‚ХґХЁХќ Х¶ХёЦЂ ХЈХЎХІХїХ¶ХЎХўХЎХј ХЅХЎХ°ХґХЎХ¶ХҐХ¬ХёЦ‚ Х°ХЎХґХЎЦЂ (ХЈХёЦЂХ®ХёЦ‚Хґ Х§ 1 ХЄХЎХґ)Хќ {url}'
};
