import { z } from 'zod';
import { parseVideoUrl } from '#lib/components/site/hero/youtube.ts';
import { heroTypes } from './hero-enums';
import { coverKeySchema, yerevanDateTime, type PostText } from './posts';
import { requireEnIfAny } from './localized';
import { localizedText } from './site-settings';

/* Admin form "Hero blocks" (docs/05 section 4; rules — docs/todo.md 2.6). */

export * from './hero-enums';

const optional = <T extends z.ZodType>(schema: T) =>
	schema.nullish().transform((v) => (v ?? null) as z.output<T> | null);

const keepFilled = (text: Record<string, string | undefined>): PostText => {
	const kept: PostText = {};
	for (const lang of ['en', 'hy', 'ru'] as const) if (text[lang]) kept[lang] = text[lang];
	return kept;
};
const plain = (max: number) =>
	z.string().trim().max(max, { error: 'auth.error.tooLong' }).optional();
const localizedOptional = (max: number) =>
	z
		.object({ en: plain(max), hy: plain(max), ru: plain(max) })
		.default({})
		.transform(keepFilled);

/** Button link: http(s) or a path on this site ('//host' and '/\host' leave the site). */
const ctaUrl = z
	.string()
	.trim()
	.max(500, { error: 'auth.error.tooLong' })
	.refine((v) => /^\/(?![/\\])\S*$/.test(v) || (/^https?:\/\/\S+$/.test(v) && URL.canParse(v)), {
		error: 'hero.error.ctaUrl'
	});

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export const heroFormSchema = z
	.object({
		type: z.enum(heroTypes, { error: 'hero.error.type' }),
		title: localizedText(200),
		subtitle: localizedOptional(300).superRefine(requireEnIfAny),
		mediaKey: optional(coverKeySchema),
		videoUrl: optional(z.string().trim().max(500, { error: 'auth.error.tooLong' })),
		ctaLabel: localizedOptional(60),
		ctaUrl: optional(ctaUrl),
		eventId: optional(z.string().trim()),
		personUserId: optional(z.string().trim()),
		startsAt: optional(yerevanDateTime('events.error.date')),
		endsAt: optional(yerevanDateTime('events.error.date')),
		isActive: z.union([z.boolean(), z.string()]).optional()
	})
	.superRefine((v, ctx) => {
		const issue = (path: (string | number)[], message: string) =>
			ctx.addIssue({ code: 'custom', path, message });
		if (v.type === 'event' && !UUID.test(v.eventId ?? '')) issue(['eventId'], 'hero.error.event');
		if (v.type === 'person' && !UUID.test(v.personUserId ?? '')) {
			issue(['personUserId'], 'hero.error.person');
		}
		if (v.type === 'video' && !parseVideoUrl(v.videoUrl ?? '')) {
			issue(['videoUrl'], 'hero.error.video');
		}
		const hasLabel = Object.keys(v.ctaLabel).length > 0;
		if (v.ctaUrl && !v.ctaLabel.en) issue(['ctaLabel', 'en'], 'auth.error.required');
		if (hasLabel && !v.ctaUrl) issue(['ctaUrl'], 'hero.error.ctaUrl');
		if (v.startsAt && v.endsAt && v.endsAt < v.startsAt) {
			issue(['endsAt'], 'events.error.endsBeforeStarts');
		}
	})
	.transform((v) => ({
		...v,
		ctaLabel: Object.keys(v.ctaLabel).length > 0 ? v.ctaLabel : null,
		eventId: v.type === 'event' ? v.eventId : null,
		personUserId: v.type === 'person' ? v.personUserId : null,
		videoUrl: v.type === 'video' ? v.videoUrl : null,
		isActive: v.isActive === true || v.isActive === 'on' || v.isActive === 'true'
	}));
export type HeroValues = z.output<typeof heroFormSchema>;
