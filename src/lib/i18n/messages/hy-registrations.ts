import type { Messages } from '../translate';

/** Գրանցումներ միջոցառումներին՝ նամակներ, մասնակցության վճար։ `hy`-ի մաս։ */
export const hyRegistrations: Partial<Messages> = {
	'registrations.payment.description': 'Մասնակցություն՝ {event}',
	'registrations.mail.promoted.subject': 'Տեղ է ազատվել՝ {event}',
	'registrations.mail.promoted.text':
		'Բարև, {name}։\n\n«{event}» միջոցառմանը ({date}) տեղ է ազատվել, և դուք գրանցված եք։\n\nՄիջոցառման էջը՝ {url}',
	'registrations.mail.promoted.textPay':
		'Բարև, {name}։\n\n«{event}» միջոցառմանը ({date}) տեղ է ազատվել։ Վճարեք մասնակցության վճարը մինչև {until}, որպեսզի պահպանեք այն․ դրանից հետո տեղը կանցնի հերթի հաջորդին։\n\nՄիջոցառման էջը՝ {url}'
};
