import type { Locale } from './locales';
import { en } from './messages/en';
import { hy } from './messages/hy';
import { ru } from './messages/ru';

export type MessageKey = keyof typeof en;
export type Messages = Record<MessageKey, string>;
export type MessageParams = Record<string, string | number>;

const dictionaries: Record<Locale, Partial<Messages>> = { en, hy, ru };

/** Fills {name} placeholders; unknown ones stay visible so a missing param is noticed. */
export function interpolate(text: string, params: MessageParams): string {
	return text.replace(/\{(\w+)\}/g, (match, name: string) =>
		Object.hasOwn(params, name) ? String(params[name]) : match
	);
}

/** Text for the key in the locale, English if missing. */
export function translate(locale: Locale, key: MessageKey, params?: MessageParams): string {
	const text = dictionaries[locale][key] ?? en[key];
	return params ? interpolate(text, params) : text;
}
