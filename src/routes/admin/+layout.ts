import { loadLocale } from '#lib/i18n/dictionaries.ts';
import { isLocale } from '#lib/i18n/locales.ts';
import type { LayoutLoad } from './$types';

/* The admin panel speaks the profile language (data.locale), not the URL's. */
export const load: LayoutLoad = async ({ data }) => {
	if (isLocale(data.locale)) await loadLocale(data.locale);
	return data;
};
