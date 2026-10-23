import type { Messages } from '../translate';

/** Գրանցումներ միջոցառումներին՝ բլոկը միջոցառման էջում, նամակներ, մասնակցության վճար։ `hy`-ի մաս։ */
export const hyRegistrations: Partial<Messages> = {
	'registrations.title': 'Գրանցում',
	'registrations.guest': 'Մուտք գործեք՝ գրանցվելու համար',
	'registrations.opensAt': 'Գրանցումը կբացվի {date}։',
	'registrations.refused.not_open': 'Գրանցումը դեռ չի բացվել։',
	'registrations.refused.closed': 'Գրանցումը փակ է։',
	'registrations.refused.blocked': 'Ձեր հաշիվն արգելափակված է․ գրանցումը հասանելի չէ։',
	'registrations.refused.email_unverified': 'Հաստատեք ձեր email-ը՝ գրանցվելու համար։',
	'registrations.refused.no_membership': 'Մասնակցության համար անհրաժեշտ է անդամակցություն։',
	'registrations.refused.birth_date_required':
		'Նշեք ձեր ծննդյան ամսաթիվը անձնական էջում՝ գրանցվելու համար։',
	'registrations.refused.parental_consent':
		'18 տարեկանից ցածր մասնակիցներին անհրաժեշտ է ծնողի հաստատված համաձայնություն։',
	'registrations.refused.age_mismatch':
		'Ձեր տարիքը չի համապատասխանում միջոցառման ոչ մի կատեգորիայի։',
	'registrations.refused.payment_unavailable':
		'Առցանց վճարումն այժմ հասանելի չէ, ուստի վճարովի միջոցառումների գրանցումը փակ է։',
	'registrations.refused.category_required': 'Ընտրեք կատեգորիա։',
	'registrations.refused.category_invalid': 'Այս կատեգորիան ձեզ հասանելի չէ։',
	'registrations.refused.already_registered': 'Դուք արդեն գրանցված եք այս միջոցառմանը։',
	'registrations.refused.not_found': 'Միջոցառումը հասանելի չէ։',
	'registrations.link.join': 'Դառնալ անդամ',
	'registrations.link.documents': 'Վերբեռնել համաձայնությունը',
	'registrations.link.profile': 'Բացել անձնական տվյալները',
	'registrations.link.cabinet': 'Բացել անձնական էջը',
	'registrations.category': 'Կատեգորիա',
	'registrations.categoryFull': '{name} — տեղեր չկան, հերթ',
	'registrations.full': 'Տեղեր չկան։ Կանգնեք հերթում․ երբ տեղ ազատվի, այն կստանա հերթի առաջինը։',
	'registrations.paidNote':
		'Մասնակցությունը վճարովի է․ գրանցվելուց հետո տեղը սահմանափակ ժամանակով պահվում է ձեզ համար՝ վճարելու համար։',
	'registrations.submit': 'Գրանցվել',
	'registrations.submitWaitlist': 'Կանգնել հերթում',
	'registrations.registered': 'Դուք գրանցված եք։',
	'registrations.attended': 'Դուք մասնակցել եք այս միջոցառմանը։',
	'registrations.waitlist': 'Դուք հերթում եք։ Երբ տեղ ազատվի, մենք ձեզ կգրենք էլ. փոստով։',
	'registrations.held':
		'Տեղը պահվում է ձեզ համար մինչև {time}։ Վճարեք՝ գրանցումը հաստատելու համար։',
	'registrations.heldLeft': 'Մնաց {minutes} րոպե',
	'registrations.expired': 'Վճարման ժամանակը սպառվել է․ տեղն անցնում է հերթի հաջորդին։',
	'registrations.pay': 'Վճարել մասնակցության համար',
	'registrations.cancelUntil': 'Չեղարկել կարելի է մինչև {date}։',
	'registrations.cancelLate': 'Գրանցումն այլևս հնարավոր չէ չեղարկել։',
	'registrations.cancel': 'Չեղարկել գրանցումը',
	'registrations.leaveWaitlist': 'Դուրս գալ հերթից',
	'registrations.cancelled': 'Գրանցումը չեղարկված է։',
	'registrations.changed': 'Գրանցումը փոխվել է։ Թարմացրեք էջը։',
	'registrations.payError.unavailable': 'Առցանց վճարումն այժմ հասանելի չէ։',
	'registrations.payError.provider_error':
		'Վճարային ծառայությունը չպատասխանեց։ Փորձեք կրկին մի քանի րոպեից։',
	'registrations.payError.hold_expired': 'Վճարման ժամանակը սպառվել է։',
	'registrations.payError.closed': 'Այս միջոցառման գրանցումը փակ է։',
	'registrations.payment.description': 'Մասնակցություն՝ {event}',
	'registrations.points.cancelled': '«{event}» միջոցառման գրանցումը չեղարկվել է մինչև մեկնարկը',
	'registrations.mail.promoted.subject': 'Տեղ է ազատվել՝ {event}',
	'registrations.mail.promoted.text':
		'Բարև, {name}։\n\n«{event}» միջոցառմանը ({date}) տեղ է ազատվել, և դուք գրանցված եք։\n\nՄիջոցառման էջը՝ {url}',
	'registrations.mail.promoted.textPay':
		'Բարև, {name}։\n\n«{event}» միջոցառմանը ({date}) տեղ է ազատվել։ Վճարեք մասնակցության վճարը մինչև {until}, որպեսզի պահպանեք այն․ դրանից հետո տեղը կանցնի հերթի հաջորդին։\n\nՄիջոցառման էջը՝ {url}'
};
