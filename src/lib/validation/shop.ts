import { z } from 'zod';
import { richTextSchema } from '#lib/server/rich-text/schema.ts';
import { intField } from './events';
import { requireEnIfAny } from './localized';
import { slugSchema } from './pages';
import { coverKeySchema, type PostText } from './posts';
import {
	ITEM_IMAGES_MAX,
	ITEM_OPTIONS_MAX,
	itemFormStatuses,
	TRACKING_NOTE_MAX
} from './shop-limits';
import { localizedText } from './site-settings';

/* Admin form "Products" (docs/05 section 14; limits — docs/todo.md 7.4, decisions 5–8). */

const OPTION_VALUES_MAX = 20;
const OPTION_TEXT_MAX = 40;

const tooLong = { error: 'auth.error.tooLong' } as const;

const optionRow = z.object({
	name: z
		.string({ error: 'auth.error.required' })
		.trim()
		.min(1, { error: 'auth.error.required' })
		.max(OPTION_TEXT_MAX, tooLong),
	values: z
		.string({ error: 'shop.error.optionValues' })
		.transform((raw) => [...new Set(raw.split(',').map((v) => v.trim()))].filter(Boolean))
});

/** Rows "Size" + "S, M, L" → `{ Size: ['S', 'M', 'L'] }`; no rows → `null`. */
const optionsSchema = z
	.array(optionRow)
	.max(ITEM_OPTIONS_MAX, { error: 'shop.error.options' })
	.default([])
	.superRefine((rows, ctx) => {
		const seen = new Set<string>();
		rows.forEach((row, i) => {
			const issue = (field: 'name' | 'values', message: string) =>
				ctx.addIssue({ code: 'custom', path: [i, field], message });
			if (seen.has(row.name.toLowerCase())) issue('name', 'shop.error.optionRepeat');
			seen.add(row.name.toLowerCase());
			if (row.values.length === 0) issue('values', 'shop.error.optionValues');
			if (row.values.length > OPTION_VALUES_MAX) issue('values', 'shop.error.options');
			if (row.values.some((v) => v.length > OPTION_TEXT_MAX)) issue('values', tooLong.error);
		});
	})
	.transform((rows) =>
		rows.length ? Object.fromEntries(rows.map((r) => [r.name, r.values])) : null
	);

export const itemFormSchema = (mediaBaseUrl: string | null) => {
	const rich = richTextSchema(mediaBaseUrl).optional();
	return z.object({
		slug: slugSchema,
		title: localizedText(200),
		description: z
			.object({ en: rich, hy: rich, ru: rich })
			.default({})
			.transform((d) => {
				const kept: PostText = {};
				for (const lang of ['en', 'hy', 'ru'] as const) if (d[lang]) kept[lang] = d[lang];
				return kept;
			})
			.superRefine(requireEnIfAny),
		imageKeys: z
			.array(coverKeySchema)
			.max(ITEM_IMAGES_MAX, { error: 'shop.error.images' })
			.default([])
			.transform((keys) => [...new Set(keys)]),
		pricePoints: intField(1, 1_000_000, 'shop.error.price'),
		options: optionsSchema,
		stock: intField(0, 1_000_000, 'shop.error.stock')
			.nullish()
			.transform((v) => v ?? null),
		status: z.enum(itemFormStatuses, { error: 'pages.error.status' }),
		sortOrder: intField(0, 9999, 'shop.error.sortOrder').default(0)
	});
};
export type ItemValues = z.output<ReturnType<typeof itemFormSchema>>;

/** docs/05 section 15: the shipping note (a tracking number); empty — no note. */
export const trackingNoteSchema = z
	.string()
	.trim()
	.max(TRACKING_NOTE_MAX, tooLong)
	.nullish()
	.transform((v) => v || null);
