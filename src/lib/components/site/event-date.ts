import type { Locale } from '#lib/i18n/locales.ts';

/** Start – end as people in Armenia see it, whatever the reader's clock. */
export function eventDates(startsAt: Date, endsAt: Date, locale: Locale | string) {
	return new Intl.DateTimeFormat(locale, {
		dateStyle: 'medium',
		timeStyle: 'short',
		timeZone: 'Asia/Yerevan'
	}).formatRange(startsAt, endsAt);
}

export const eventMoment = (date: Date, locale: Locale | string) =>
	date.toLocaleString(locale, { dateStyle: 'long', timeStyle: 'short', timeZone: 'Asia/Yerevan' });
