import { defineParams } from '@sveltejs/kit/params';
import { defaultLocale, isLocale } from '#lib/i18n/locales.ts';

export const params = defineParams({
	/** Optional route prefix: only non-default locales (/hy, /ru); English has no prefix. */
	lang: (param) => (isLocale(param) && param !== defaultLocale ? param : undefined)
});
