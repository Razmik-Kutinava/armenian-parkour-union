import { locales, type Locale } from './locales';
import { en } from './messages/en';
import type { Messages } from './translate';

type Dictionary = Partial<Messages>;

/* Only dynamic imports: a static one would put every language into the browser bundle. */
const load: Record<Locale, () => Promise<Dictionary>> = {
	en: async () => en,
	hy: async () => (await import('./messages/hy')).hy,
	ru: async () => (await import('./messages/ru')).ru
};

const loaded: Partial<Record<Locale, Dictionary>> = { en };

/* Each language is a third of all the texts: the browser gets English (the fallback) at once and
 * another language when a page in it opens. The server has them all — letters and cron jobs
 * translate without a page. */
if (import.meta.env.SSR) {
	for (const locale of locales) loaded[locale] = await load[locale]();
}

export const dictionary = (locale: Locale): Dictionary | undefined => loaded[locale];

/** Before rendering in the browser: a layout `load` awaits the page's language. */
export async function loadLocale(locale: Locale): Promise<void> {
	loaded[locale] ??= await load[locale]();
}
