import { z } from 'zod';
import { richTextSchema } from '#lib/server/rich-text/schema.ts';
import { pageStatuses, slugSchema, type PageBody } from './pages';
import { localizedText } from './site-settings';

/* Admin form "News" (docs/05 section 18; rules — docs/todo.md 2.4, accepted 2026-10-08). */

export const postStatuses = pageStatuses;
export type PostStatus = (typeof postStatuses)[number];
export type PostText = Partial<Record<'en' | 'hy' | 'ru', string>>;

export const EXCERPT_MAX = 300;
export const TAGS_MAX = 10;
export const TAG_MAX = 32;

/** One language, lower case, no repeats: "Kids, jam,kids" → ['kids', 'jam']. */
export function parseTags(raw: string): string[] {
	const tags = raw.split(',').map((t) => t.trim().replace(/\s+/g, ' ').toLowerCase());
	return [...new Set(tags.filter(Boolean))];
}

/* Armenia keeps UTC+4 all year (no DST since 2012): the admin types Yerevan time. */
const YEREVAN_OFFSET_MS = 4 * 3_600_000;
const LOCAL_DATE_TIME = /^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])T([01]\d|2[0-3]):[0-5]\d$/;

export const toYerevanInput = (date: Date) =>
	new Date(date.getTime() + YEREVAN_OFFSET_MS).toISOString().slice(0, 16);

const publishedAtSchema = z
	.string()
	.regex(LOCAL_DATE_TIME, { error: 'news.error.date' })
	.transform((value, ctx) => {
		const date = new Date(`${value}:00+04:00`);
		if (Number.isNaN(date.getTime()) || toYerevanInput(date) !== value) {
			ctx.addIssue({ code: 'custom', message: 'news.error.date' });
			return z.NEVER;
		}
		return date;
	});

const excerptText = z.string().trim().max(EXCERPT_MAX, { error: 'auth.error.tooLong' }).optional();

const tagsSchema = z
	.string()
	.transform(parseTags)
	.refine((tags) => tags.length <= TAGS_MAX && tags.every((t) => t.length <= TAG_MAX), {
		error: 'news.error.tags'
	});

/** Keys as the library makes them (`media/2026/10/<uuid>.webp`): no `..`, no other prefix. */
const coverKeySchema = z.string().regex(/^media\/(?:[A-Za-z0-9_-]+\/)*[A-Za-z0-9_-]+\.[a-z0-9]+$/, {
	error: 'news.error.cover'
});

const keepFilled = (text: Record<string, string | undefined>): PostText => {
	const kept: PostText = {};
	for (const lang of ['en', 'hy', 'ru'] as const) if (text[lang]) kept[lang] = text[lang];
	return kept;
};

export const postFormSchema = (mediaBaseUrl: string | null) => {
	const rich = richTextSchema(mediaBaseUrl).optional();
	return z.object({
		slug: slugSchema,
		title: localizedText(200),
		excerpt: z
			.object({ en: excerptText, hy: excerptText, ru: excerptText })
			.default({})
			.transform(keepFilled),
		body: z
			.object({ en: rich, hy: rich, ru: rich })
			.default({})
			.transform((body): PageBody => keepFilled(body)),
		coverKey: coverKeySchema.nullish().transform((v) => v ?? null),
		tags: tagsSchema.default([]),
		status: z.enum(postStatuses, { error: 'pages.error.status' }),
		publishedAt: publishedAtSchema.nullish().transform((v) => v ?? null),
		authorId: z
			.uuid({ error: 'news.error.author' })
			.nullish()
			.transform((v) => v ?? null)
	});
};
export type PostValues = z.output<ReturnType<typeof postFormSchema>>;
