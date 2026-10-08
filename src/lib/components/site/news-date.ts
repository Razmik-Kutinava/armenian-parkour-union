import type { Locale } from '#lib/i18n/locales.ts';

/** Publication date as people in Armenia see it, whatever the reader's clock. */
export const newsDate = (date: Date, locale: Locale) =>
	date.toLocaleDateString(locale, { dateStyle: 'long', timeZone: 'Asia/Yerevan' });
