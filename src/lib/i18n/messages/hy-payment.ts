import type { Messages } from '../translate';

export const hyPayment: Partial<Messages> = {
	'payment.kind.membership': 'Անդամավճար',
	'payment.kind.donation': 'Նվիրատվություն',
	'payment.kind.event_fee': 'Միջոցառման մասնակցության վճար',
	'payment.amount': '{kind}՝ {amount}',
	'payment.paid.title': 'Վճարումը ստացված է',
	'payment.paid.membership': 'Շնորհակալություն։ Ֆեդերացիայում ձեր անդամակցությունը գործում է։',
	'payment.paid.donation':
		'Շնորհակալություն ֆեդերացիային աջակցելու համար։ Անդորրագիրն ուղարկել ենք ձեր էլ. փոստին։',
	'payment.paid.event_fee': 'Շնորհակալություն։ Ձեր վճարումը ստացված է։',
	'payment.checking.title': 'Վճարումը ստուգվում է…',
	'payment.checking.text': 'Սովորաբար դա տևում է մի քանի վայրկյան։ Խնդրում ենք չփակել այս էջը։',
	'payment.processing.title': 'Վճարումը մշակվում է',
	'payment.processing.text':
		'Բանկը դեռ չի հաստատել այն։ Հաստատվելուն պես մենք ձեզ նամակ կուղարկենք։',
	'payment.notCompleted.title': 'Վճարումը չի ավարտվել',
	'payment.notCompleted.text':
		'Եթե գումարն այնուամենայնիվ գանձվել է, մենք ավտոմատ կհաստատենք վճարումը և ձեզ նամակ կուղարկենք։',
	'payment.failed.title': 'Վճարումը չի կատարվել',
	'payment.failed.text': 'Բանկը չի հաստատել վճարումը։ Կարող եք փորձել կրկին։',
	'payment.cancelled.title': 'Վճարումը չեղարկվել է',
	'payment.cancelled.text': 'Կարող եք փորձել կրկին ցանկացած ժամանակ։',
	'payment.refunded.title': 'Վճարումը վերադարձվել է',
	'payment.refunded.text': 'Այս վճարման գումարը վերադարձվել է։',
	'payment.retry': 'Փորձել կրկին',
	'payment.toMembership': 'Իմ անդամակցությունը',
	'payment.toHome': 'Գլխավոր էջ',
	'payment.refresh': 'Թարմացնել էջը',
	'payment.mail.refund.subject': 'Ձեր վճարումը վերադարձվել է',
	'payment.mail.refund.text':
		'Բարև ձեզ, {name}։\n\nՄենք վերադարձրել ենք Armenian Parkour Union-ին կատարված ձեր վճարումը։\n\nԳումար՝ {amount}\nՎճարման համար՝ {payment}\n\nԵրբ գումարը կհասնի ձեր հաշվին, կախված է ձեր բանկից, սովորաբար՝ մի քանի աշխատանքային օր։'
};
