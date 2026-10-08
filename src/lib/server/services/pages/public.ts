import { and, eq, isNull } from 'drizzle-orm';
import { pickLocalized, type LocalizedText } from '#lib/i18n/localized.ts';
import type { Locale } from '#lib/i18n/locales.ts';
import type { PageBody } from '#lib/validation/pages.ts';
import type { LimitDb } from '../../auth/rate-limit';
import { pages } from '../../db/schema/content';

export type PublicPage = { slug: string; title: string; html: string };

/**
 * docs/06 section 4.5: only a published page is shown, to everyone alike. Title and text fall back
 * to English separately. The HTML was cleaned on save (server/rich-text).
 */
export async function getPublishedPage(
	db: LimitDb,
	slug: string,
	locale: Locale
): Promise<PublicPage | null> {
	const [row] = await db
		.select({ slug: pages.slug, title: pages.title, body: pages.body })
		.from(pages)
		.where(and(eq(pages.slug, slug), eq(pages.status, 'published'), isNull(pages.deletedAt)));
	if (!row) return null;
	const body = row.body as PageBody;
	return {
		slug: row.slug,
		title: pickLocalized(row.title as LocalizedText, locale),
		html: body[locale] || body.en || ''
	};
}
