import type { Locale } from './locales';

/** Multilingual jsonb value: English is required and is the fallback (docs/decisions.md, 1.4). */
export type LocalizedText = { en: string } & Partial<Record<Exclude<Locale, 'en'>, string>>;

export function pickLocalized(value: LocalizedText, locale: Locale): string {
	return value[locale] || value.en;
}
