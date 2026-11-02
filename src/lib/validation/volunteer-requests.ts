import { z } from 'zod';
import { richTextSchema } from '#lib/server/rich-text/schema.ts';
import { requireEnIfAny } from './localized';
import { yerevanDateTime, type PostText } from './posts';
import { localizedText } from './site-settings';
import { intField } from './events';

/* Admin form for volunteer requests (docs/05 section 28, docs/02 section 12). */

const blankToNull = (v: unknown) => (typeof v === 'string' && v.trim() === '' ? null : v);

export const requestFormSchema = (mediaBaseUrl: string | null) => {
	const rich = richTextSchema(mediaBaseUrl).optional();
	return z
		.object({
			title: localizedText(200),
			description: z
				.object({ en: rich, hy: rich, ru: rich })
				.default({})
				.transform((d): PostText | null => {
					const kept: PostText = {};
					for (const lang of ['en', 'hy', 'ru'] as const) if (d[lang]) kept[lang] = d[lang];
					return Object.keys(kept).length ? kept : null;
				})
				.superRefine(requireEnIfAny),
			eventId: z.preprocess(
				blankToNull,
				z
					.uuid({ error: 'volunteer.requests.error.event' })
					.nullish()
					.transform((v) => v ?? null)
			),
			startsAt: yerevanDateTime('events.error.date'),
			endsAt: yerevanDateTime('events.error.date'),
			location: z.preprocess(
				blankToNull,
				z
					.string()
					.trim()
					.max(200, { error: 'auth.error.tooLong' })
					.nullish()
					.transform((v) => v ?? null)
			),
			places: intField(1, 500, 'volunteer.requests.error.places'),
			respondBy: yerevanDateTime('events.error.date')
		})
		.superRefine((v, ctx) => {
			if (v.endsAt < v.startsAt) {
				ctx.addIssue({
					code: 'custom',
					path: ['endsAt'],
					message: 'events.error.endsBeforeStarts'
				});
			}
			if (v.respondBy > v.startsAt) {
				ctx.addIssue({
					code: 'custom',
					path: ['respondBy'],
					message: 'volunteer.requests.error.respondBy'
				});
			}
		});
};
export type RequestFormValues = z.output<ReturnType<typeof requestFormSchema>>;
