import { z } from 'zod';
import { richTextSchema } from '#lib/server/rich-text/schema.ts';
import { localizedText } from './site-settings';

/* Admin form "Pages" (docs/05 section 19; decisions.md 2026-10-08). */

export const SYSTEM_PAGE_SLUGS = [
	'about',
	'rules',
	'contacts',
	'privacy',
	'offer',
	'refund-policy'
] as const;
export const isSystemSlug = (slug: string) =>
	(SYSTEM_PAGE_SLUGS as readonly string[]).includes(slug);

export const pageStatuses = ['draft', 'published', 'archived'] as const;
export type PageStatus = (typeof pageStatuses)[number];

export const SLUG_MAX = 80;
const slugSchema = z
	.string({ error: 'auth.error.required' })
	.max(SLUG_MAX, { error: 'auth.error.tooLong' })
	.regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, { error: 'pages.error.slug' });

export type PageBody = Partial<Record<'en' | 'hy' | 'ru', string>>;

export const pageFormSchema = (mediaBaseUrl: string | null) => {
	const rich = richTextSchema(mediaBaseUrl).optional();
	return z.object({
		slug: slugSchema,
		title: localizedText(200),
		body: z
			.object({ en: rich, hy: rich, ru: rich })
			.default({})
			.transform((body): PageBody => {
				const kept: PageBody = {};
				for (const lang of ['en', 'hy', 'ru'] as const) if (body[lang]) kept[lang] = body[lang];
				return kept;
			}),
		status: z.enum(pageStatuses, { error: 'pages.error.status' })
	});
};
export type PageValues = z.output<ReturnType<typeof pageFormSchema>>;
