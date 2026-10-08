import { z } from 'zod';
import type { MessageKey } from '#lib/i18n/translate.ts';
import { richTextSchema } from '#lib/server/rich-text/schema.ts';
import { CURRENCIES, priceToMinor } from '#lib/money.ts';
import { disciplines, eventFormStatuses } from './event-enums';
import { slugSchema } from './pages';
import { coverKeySchema, yerevanDateTime, type PostText } from './posts';
import { localizedText } from './site-settings';

/* Admin form "Events" (docs/05 section 5; rules — decisions.md 2026-10-08, 2.5 defaults 1–12). */

export * from './event-enums';
/** `/events/archive` is a page of its own. */
const RESERVED_SLUGS = ['archive'];

const optional = <T extends z.ZodType>(schema: T) =>
	schema.nullish().transform((v) => (v ?? null) as z.output<T> | null);

const text = (max: number) => optional(z.string().trim().max(max, { error: 'auth.error.tooLong' }));

/** Whole number typed in a field, within limits. */
const intField = (min: number, max: number, error: MessageKey) =>
	z
		.union([
			z.number(),
			z
				.string()
				.trim()
				.regex(/^-?\d{1,9}$/, { error })
		])
		.transform(Number)
		.pipe(z.number({ error }).int({ error }).min(min, { error }).max(max, { error }));

const coordinate = (limit: number, error: MessageKey) =>
	z
		.string()
		.regex(/^-?\d{1,3}(?:\.\d{1,6})?$/, { error })
		.transform(Number)
		.refine((n) => Math.abs(n) <= limit, { error });

const date = (error: MessageKey) => yerevanDateTime(error);

export const eventFormSchema = (mediaBaseUrl: string | null) => {
	const rich = richTextSchema(mediaBaseUrl).optional();
	return z
		.object({
			slug: slugSchema.refine((s) => !RESERVED_SLUGS.includes(s), { error: 'events.error.slug' }),
			title: localizedText(200),
			description: z
				.object({ en: rich, hy: rich, ru: rich })
				.default({})
				.transform((d) => {
					const kept: PostText = {};
					for (const lang of ['en', 'hy', 'ru'] as const) if (d[lang]) kept[lang] = d[lang];
					return kept;
				}),
			coverKey: optional(coverKeySchema),
			startsAt: date('events.error.date'),
			endsAt: date('events.error.date'),
			locationName: text(200),
			address: text(300),
			city: text(100),
			latitude: optional(coordinate(90, 'events.error.latitude')),
			longitude: optional(coordinate(180, 'events.error.longitude')),
			capacity: optional(intField(1, 1_000_000, 'events.error.capacity')),
			price: z.string({ error: 'events.error.price' }),
			priceCurrency: z.enum(CURRENCIES, { error: 'events.error.currency' }),
			registrationOpensAt: optional(date('events.error.date')),
			registrationClosesAt: optional(date('events.error.date')),
			status: z.enum(eventFormStatuses, { error: 'pages.error.status' }),
			publishedAt: optional(date('news.error.date'))
		})
		.superRefine((v, ctx) => {
			const issue = (path: string, message: MessageKey) =>
				ctx.addIssue({ code: 'custom', path: [path], message });
			if (v.endsAt < v.startsAt) issue('endsAt', 'events.error.endsBeforeStarts');
			const { registrationOpensAt: opens, registrationClosesAt: closes } = v;
			if (opens && closes && closes < opens) {
				issue('registrationClosesAt', 'events.error.closesBeforeOpens');
			}
			if (v.latitude !== null && v.longitude === null) issue('longitude', 'events.error.coords');
			if (v.latitude === null && v.longitude !== null) issue('latitude', 'events.error.coords');
			if (priceToMinor(v.price, v.priceCurrency) === null) issue('price', 'events.error.price');
		})
		.transform(({ price, ...v }) => ({
			...v,
			priceAmountMinor: priceToMinor(price, v.priceCurrency) as number
		}));
};
export type EventValues = z.output<ReturnType<typeof eventFormSchema>>;

export const eventCategorySchema = z
	.object({
		name: localizedText(200),
		discipline: z.enum(disciplines, { error: 'events.error.discipline' }),
		ageMin: optional(intField(0, 99, 'events.error.age')),
		ageMax: optional(intField(0, 99, 'events.error.age')),
		capacity: optional(intField(1, 1_000_000, 'events.error.capacity')),
		sortOrder: intField(0, 9999, 'events.error.sortOrder').default(0)
	})
	.superRefine((v, ctx) => {
		if (v.ageMin !== null && v.ageMax !== null && v.ageMin > v.ageMax) {
			ctx.addIssue({ code: 'custom', path: ['ageMax'], message: 'events.error.ageOrder' });
		}
	});
export type EventCategoryValues = z.output<typeof eventCategorySchema>;

export const cancelReasonSchema = z
	.string({ error: 'auth.error.required' })
	.trim()
	.min(1, { error: 'auth.error.required' })
	.max(500, { error: 'auth.error.tooLong' });
