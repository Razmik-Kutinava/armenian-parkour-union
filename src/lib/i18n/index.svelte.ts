import { page } from '$app/state';
import { localeFromPath, type Locale } from './locales';
import { translate, type MessageKey, type MessageParams } from './translate';

export * from './locales';
export type { MessageKey, MessageParams } from './translate';

/** Locale of the current page, from the URL. Reactive inside components. */
export function currentLocale(): Locale {
	return localeFromPath(page.url.pathname);
}

/** Translate for the current page: {t('common.close')} */
export function t(key: MessageKey, params?: MessageParams): string {
	return translate(currentLocale(), key, params);
}
