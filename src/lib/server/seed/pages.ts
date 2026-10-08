import type { LocalizedText } from '#lib/i18n/localized.ts';
import type { LimitDb } from '../auth/rate-limit';
import { pages } from '../db/schema/content';

/*
 * System pages (docs/02 seed; decisions.md 2026-10-08): drafts with a title and no text — the owner
 * writes the text and publishes them in the admin panel.
 */
export const SEED_PAGES: Record<string, Required<LocalizedText>> = {
	about: { en: 'About us', hy: 'Մեր մասին', ru: 'О нас' },
	rules: { en: 'Rules', hy: 'Կանոններ', ru: 'Правила' },
	contacts: { en: 'Contacts', hy: 'Կոնտակտներ', ru: 'Контакты' },
	privacy: {
		en: 'Privacy policy',
		hy: 'Գաղտնիության քաղաքականություն',
		ru: 'Политика конфиденциальности'
	},
	offer: { en: 'Public offer', hy: 'Հանրային օֆերտա', ru: 'Публичная оферта' },
	'refund-policy': {
		en: 'Refund policy',
		hy: 'Վերադարձի քաղաքականություն',
		ru: 'Политика возврата'
	}
};

/** Adds missing pages only: text and status set in the admin panel are never overwritten. */
export async function seedPages(db: LimitDb): Promise<string[]> {
	const rows = await db
		.insert(pages)
		.values(
			Object.entries(SEED_PAGES).map(([slug, title]) => ({
				slug,
				title,
				status: 'draft' as const,
				isSystem: true
			}))
		)
		.onConflictDoNothing({ target: pages.slug })
		.returning({ slug: pages.slug });
	return rows.map((r) => r.slug);
}
