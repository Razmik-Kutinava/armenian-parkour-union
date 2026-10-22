import type { Messages } from '../translate';

export const hyMembership: Partial<Messages> = {
	'membership.payment.description': 'Armenian Parkour Union-ի անդամավճար',
	'membership.mail.paid.subject': 'Անդամավճարը ստացված է',
	'membership.mail.paid.text':
		'Բարև ձեզ, {name}։\n\nՄենք ստացել ենք ձեր անդամավճարը։ Շնորհակալություն։\n\nԳումար՝ {amount}\nԱմսաթիվ՝ {date}\nՆպատակ՝ անդամավճար, {from} – {to}\nՎճարման համար՝ {payment}\n\nՁեր անդամակցությունը՝ {url}',
	'membership.mail.requisites': 'Ֆեդերացիայի վավերապայմանները՝',
	'membership.mail.reminder.subject': 'Ձեր անդամակցությունն ավարտվում է {date}',
	'membership.mail.reminder.text':
		'Բարև ձեզ, {name}։\n\nՖեդերացիայում ձեր անդամակցությունն ավարտվում է {date}։ Երկարացրեք այն, որպեսզի շարունակեք գրանցվել միջոցառումների և հանձնել քննություններ՝ {url}',
	'membership.fee.title': 'Անդամավճար',
	'membership.fee.amount': '{amount}՝ {months} ամսով',
	'membership.fee.notSet': 'Անդամավճարի գումարը կհայտարարվի շուտով։',
	'membership.pay.submit': 'Վճարել անդամավճարը',
	'membership.pay.renew': 'Երկարացնել անդամակցությունը',
	'membership.pay.emailUnverified':
		'Նախ հաստատեք ձեր էլ. փոստը՝ բացեք գրանցման ժամանակ ուղարկված նամակի հղումը։',
	'membership.pay.unavailable':
		'Առցանց վճարումն այս պահին հասանելի չէ։ Խնդրում ենք փորձել ավելի ուշ։',
	'membership.pay.providerError': 'Չհաջողվեց սկսել վճարումը։ Խնդրում ենք փորձել կրկին։',
	'join.title': 'Միանալ ֆեդերացիային',
	'join.signUp': 'Ստեղծել հաշիվ',
	'join.logIn': 'Մուտք',
	'join.member': 'Դուք արդեն ֆեդերացիայի անդամ եք։',
	'join.cabinet': 'Իմ անդամակցությունը',
	'cabinet.membership.title': 'Անդամակցություն',
	'cabinet.membership.activeUntil': 'Գործում է մինչև {date}',
	'cabinet.membership.none': 'Գործող անդամակցություն չկա',
	'cabinet.membership.waiting': 'Սպասվում է վճարման հաստատում',
	'cabinet.membership.history': 'Պատմություն',
	'cabinet.membership.period': '{from} – {to}',
	'cabinet.membership.status.active': 'Գործող',
	'cabinet.membership.status.expired': 'Ժամկետանց',
	'cabinet.membership.status.cancelled': 'Չեղարկված',
	'cabinet.membership.status.pending': 'Սպասվում է վճարում'
};
