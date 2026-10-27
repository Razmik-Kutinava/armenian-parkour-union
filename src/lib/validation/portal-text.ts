import { z } from 'zod';
import type { PortalText } from '#lib/i18n/localized.ts';
import { locales } from '#lib/i18n/locales.ts';

/* Training portal texts (docs/02 section 11, decisions 2026-10-27): any one language is enough —
 * the content starts in Russian only. */

const field = (max: number) =>
	z
		.string()
		.trim()
		.max(max, { error: 'auth.error.tooLong' })
		.optional()
		.transform((s) => s || undefined);

const keepFilled = (text: Record<string, string | undefined>): PortalText => {
	const kept: PortalText = {};
	for (const lang of locales) if (text[lang]) kept[lang] = text[lang];
	return kept;
};

export const filledLanguages = (text: PortalText) => locales.filter((lang) => !!text[lang]);

/** May stay empty: `{}`. */
export const portalTextOptional = (max: number) =>
	z
		.object({ en: field(max), hy: field(max), ru: field(max) })
		.prefault({})
		.transform(keepFilled);

export const portalText = (max: number) =>
	portalTextOptional(max).refine((text) => filledLanguages(text).length > 0, {
		error: 'training.error.anyLanguage'
	});
