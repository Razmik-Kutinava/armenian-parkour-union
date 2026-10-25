import { loadLocale } from '#lib/i18n/dictionaries.ts';
import { localeFromPath } from '#lib/i18n/locales.ts';
import type { LayoutLoad } from './$types';

/* The page's texts before it renders in the browser; admin pages add the profile language. */
export const load: LayoutLoad = async ({ url }) => {
	await loadLocale(localeFromPath(url.pathname));
};
