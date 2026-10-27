import type { Locale } from './locales';

/** Multilingual jsonb value: English is required and is the fallback (docs/decisions.md, 1.4). */
export type LocalizedText = { en: string } & Partial<Record<Exclude<Locale, 'en'>, string>>;

export function pickLocalized(value: LocalizedText, locale: Locale): string {
	return value[locale] || value.en;
}

/** Training portal value: any one language may be filled (docs/02 section 11). */
export type PortalText = Partial<Record<Locale, string>>;

/** Page language → ru → en → hy (decisions 2026-10-27). */
export function pickPortal(value: PortalText | null | undefined, locale: Locale): string {
	if (!value) return '';
	return value[locale] || value.ru || value.en || value.hy || '';
}
