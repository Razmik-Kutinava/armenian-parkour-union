import { page } from '$app/state';
import { isLocale, localeFromPath, type Locale } from './locales';
import { translate, type MessageKey, type MessageParams } from './translate';

export * from './locales';
export type { MessageKey, MessageParams } from './translate';

/** Locale of the current page: a layout may set `data.locale` (admin), otherwise the URL. Reactive. */
export function currentLocale(): Locale {
	const fromData = page.data.locale;
	return isLocale(fromData) ? fromData : localeFromPath(page.url.pathname);
}

/** Translate for the current page: {t('common.close')} */
export function t(key: MessageKey, params?: MessageParams): string {
	return translate(currentLocale(), key, params);
}
