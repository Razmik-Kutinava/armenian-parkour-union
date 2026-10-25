import { isLocale, localizePath, type Locale } from '#lib/i18n/locales.ts';
import { translate } from '#lib/i18n/translate.ts';
import type { Mail } from '../../mail/resend';
import type { OrderStatus } from './order-list';

export type OrderRecipient = {
	email: string;
	locale: string;
	firstName: string | null;
	name: string;
};

/** docs/03 section 14 "order status": the new status in the member's language; shipped — the note. */
export function orderStatusLetter(
	to: OrderRecipient,
	order: { number: string; status: OrderStatus; trackingNote: string | null },
	siteUrl: string | undefined
): Mail {
	const locale: Locale = isLocale(to.locale) ? to.locale : 'en';
	const status = translate(locale, `shop.order.status.${order.status}`);
	const note =
		order.status === 'shipped' && order.trackingNote
			? translate(locale, 'shop.mail.tracking', { note: order.trackingNote })
			: '';
	return {
		to: to.email,
		subject: translate(locale, 'shop.mail.subject', { number: order.number, status }),
		text: translate(locale, 'shop.mail.text', {
			name: to.firstName ?? to.name,
			number: order.number,
			status,
			tracking: note,
			url: `${siteUrl ?? ''}${localizePath('/cabinet/orders', locale)}`
		})
	};
}
