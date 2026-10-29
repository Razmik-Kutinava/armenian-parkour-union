import { z } from 'zod';
import { intField } from './events';
import { requireEnIfAny } from './localized';
import { pageStatuses } from './pages';
import { coverKeySchema, type PostText } from './posts';
import { localizedText } from './site-settings';
import { perkKinds } from './volunteer-enums';

/* Admin "Volunteering → Partners" (docs/05 section 28, docs/02 section 12; decisions — docs/todo.md
 * 10.2). Messages are i18n keys shown at the field. */

export const PERK_USES_MAX = 100;
const DIRECTIONS = ['up', 'down'] as const;

const tooLong = { error: 'auth.error.tooLong' } as const;
const blankToNull = (v: unknown) => (typeof v === 'string' && v.trim() === '' ? null : v);

/** Several languages, any may be empty; English once another one is filled; nothing — `null`. */
const localizedOptional = (max: number) =>
	z
		.object({
			en: z.string().trim().max(max, tooLong).optional(),
			hy: z.string().trim().max(max, tooLong).optional(),
			ru: z.string().trim().max(max, tooLong).optional()
		})
		.default({})
		.transform((text) => {
			const kept: PostText = {};
			for (const lang of ['en', 'hy', 'ru'] as const) if (text[lang]) kept[lang] = text[lang];
			return kept;
		})
		.superRefine(requireEnIfAny)
		.transform((kept) => (Object.keys(kept).length ? kept : null));

/** Ends up in `href` on the check page: http(s) only. */
const website = z.preprocess(
	blankToNull,
	z
		.string()
		.trim()
		.max(500, tooLong)
		.refine((v) => /^https?:\/\/\S+$/i.test(v) && URL.canParse(v), {
			error: 'volunteer.error.website'
		})
		.nullish()
		.transform((v) => v ?? null)
);

function dayExists(value: string) {
	const [y, m, d] = value.split('-').map(Number);
	const utc = new Date(Date.UTC(y, m - 1, d));
	return utc.getUTCFullYear() === y && utc.getUTCMonth() === m - 1 && utc.getUTCDate() === d;
}

/** `YYYY-MM-DD` of a day that exists (a Yerevan day, stored as `date`). */
const day = z.preprocess(
	blankToNull,
	z
		.string()
		.regex(/^\d{4}-\d{2}-\d{2}$/, { error: 'volunteer.error.date' })
		.refine(dayExists, { error: 'volunteer.error.date' })
		.nullish()
		.transform((v) => v ?? null)
);

export const partnerFormSchema = z.object({
	name: z
		.string({ error: 'auth.error.required' })
		.trim()
		.min(1, { error: 'auth.error.required' })
		.max(120, tooLong),
	logoKey: z.preprocess(
		blankToNull,
		coverKeySchema.nullish().transform((v) => v ?? null)
	),
	website,
	address: localizedOptional(300),
	status: z.enum(pageStatuses, { error: 'pages.error.status' })
});
export type PartnerValues = z.output<typeof partnerFormSchema>;

export const partnerMoveSchema = z.object({
	partnerId: z.uuid(),
	direction: z.enum(DIRECTIONS)
});

export const perkFormSchema = z
	.object({
		title: localizedText(200),
		terms: localizedOptional(500),
		kind: z.enum(perkKinds, { error: 'volunteer.error.kind' }),
		usesLimit: z.unknown().optional(),
		validFrom: day,
		validUntil: day,
		status: z.enum(pageStatuses, { error: 'pages.error.status' }),
		sortOrder: intField(0, 9999, 'shop.error.sortOrder').default(0)
	})
	.transform((v, ctx) => {
		let usesLimit: number | null = null;
		if (v.kind === 'single') {
			const parsed = intField(1, PERK_USES_MAX, 'volunteer.error.usesLimit').safeParse(
				v.usesLimit ?? ''
			);
			if (parsed.success) usesLimit = parsed.data;
			else {
				ctx.addIssue({ code: 'custom', path: ['usesLimit'], message: 'volunteer.error.usesLimit' });
			}
		}
		if (v.validFrom && v.validUntil && v.validUntil < v.validFrom) {
			ctx.addIssue({ code: 'custom', path: ['validUntil'], message: 'volunteer.error.dateRange' });
		}
		return { ...v, usesLimit };
	});
export type PerkValues = z.output<typeof perkFormSchema>;
