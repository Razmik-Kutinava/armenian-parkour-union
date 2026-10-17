import { inArray } from 'drizzle-orm';
import { pickLocalized } from '#lib/i18n/localized.ts';
import type { Locale } from '#lib/i18n/locales.ts';
import { translate } from '#lib/i18n/translate.ts';
import { settingsFormSchema } from '#lib/validation/site-settings-form.ts';
import type { LimitDb } from '../../auth/rate-limit';
import { siteSettings } from '../../db/schema/service';

/* docs/05 section 21: what every page's SEO shares; a missing or broken key falls back to i18n. */

export type SeoBase = { siteUrl: string; siteName: string; locale: Locale; description: string };

export async function getSeoBase(db: LimitDb, locale: Locale, siteUrl: string): Promise<SeoBase> {
	const rows = await db
		.select()
		.from(siteSettings)
		.where(inArray(siteSettings.key, ['site_name', 'seo_description']));
	const pick = (key: 'site_name' | 'seo_description') => {
		const parsed = settingsFormSchema.shape[key].safeParse(rows.find((r) => r.key === key)?.value);
		return parsed.success ? pickLocalized(parsed.data, locale) : null;
	};
	return {
		siteUrl,
		siteName: pick('site_name') ?? translate(locale, 'site.name'),
		locale,
		description: pick('seo_description') ?? translate(locale, 'site.description')
	};
}
