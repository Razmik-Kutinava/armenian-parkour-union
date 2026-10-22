import type { Messages } from '../translate';

export const hyDonate: Partial<Messages> = {
	'donate.title': 'Աջակցել ֆեդերացիային',
	'donate.intro':
		'Ձեր նվիրատվությունն օգնում է Armenian Parkour Union-ին անցկացնել միջոցառումներ, պատրաստել մարզիչներ և ստեղծել մարզվելու վայրեր։',
	'donate.amount': 'Գումար ({currency})',
	'donate.range': '{min}-ից {max}',
	'donate.quick': 'Արագ գումարներ',
	'donate.purpose': 'Նպատակ',
	'donate.purpose.general': 'Ֆեդերացիայի ընդհանուր կարիքներ',
	'donate.name': 'Ձեր անունը',
	'donate.anonymous': 'Չցուցադրել իմ անունը հրապարակայնորեն',
	'donate.from': 'Նվիրատվություն՝ {name} ({email})',
	'donate.submit': 'Նվիրաբերել',
	'donate.notSet': 'Նվիրատվությունները կբացվեն շուտով։',
	'donate.recent': 'Վերջին նվիրատվությունները',
	'donate.anonymousDonor': 'Անանուն',
	'donate.error.amount': 'Մուտքագրեք գումարը ամբողջ թվով։',
	'donate.error.range': 'Մուտքագրեք գումար {min}-ից {max}։',
	'donate.error.purpose': 'Ընտրեք նպատակը ցանկից։',
	'donate.error.invalid': 'Ստուգեք ձևը. ընտրված նպատակը կարող է այլևս հասանելի չլինել։',
	'donate.error.unavailable':
		'Առցանց վճարումն այս պահին հասանելի չէ։ Խնդրում ենք փորձել ավելի ուշ։',
	'donate.error.providerError': 'Չհաջողվեց սկսել վճարումը։ Խնդրում ենք փորձել կրկին։',
	'donate.payment.description': 'Նվիրատվություն Armenian Parkour Union-ին',
	'donate.mail.subject': 'Շնորհակալություն նվիրատվության համար',
	'donate.mail.text':
		'Բարև ձեզ, {name}։\n\nՇնորհակալություն Armenian Parkour Union-ին աջակցելու համար։\n\nԳումար՝ {amount}\nԱմսաթիվ՝ {date}\nՆպատակ՝ {purpose}\nՎճարման համար՝ {payment}',
	'donate.mail.generalPurpose': 'ֆեդերացիայի ընդհանուր կարիքներ',
	'donate.mail.requisites': 'Ֆեդերացիայի վավերապայմանները՝'
};
