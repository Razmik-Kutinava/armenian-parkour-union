import { z } from 'zod';

/* docs/06 section 5.7: link, title, event (optional); the platform and duplicates — the service. */

export const videoFormSchema = z.object({
	url: z
		.string({ error: 'videos.error.url' })
		.trim()
		.min(1, { error: 'videos.error.url' })
		.max(500, { error: 'auth.error.tooLong' }),
	title: z
		.string({ error: 'videos.error.title' })
		.trim()
		.min(1, { error: 'videos.error.title' })
		.max(120, { error: 'auth.error.tooLong' }),
	eventId: z
		.string()
		.optional()
		.transform((v) => v?.trim() || null)
});
export type VideoForm = z.output<typeof videoFormSchema>;

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** One page of the queue at most (docs/05 section 1 item 2). */
export const MODERATION_BATCH = 25;

/* docs/05 section 11: the selected videos (a quick button sends one); the reason of a refusal is
 * required by the service, so one form serves every action. */
export const moderationFormSchema = z.object({
	ids: z
		.array(z.string().regex(UUID, { error: 'videos.admin.error.select' }), {
			error: 'videos.admin.error.select'
		})
		.min(1, { error: 'videos.admin.error.select' })
		.max(MODERATION_BATCH, { error: 'videos.admin.error.tooMany' }),
	comment: z
		.string()
		.trim()
		.max(1000, { error: 'auth.error.tooLong' })
		.optional()
		.transform((v) => v ?? '')
});

const LIMIT_ERROR = { error: 'videos.settings.error.limit' };
const PLATFORMS_ERROR = { error: 'videos.settings.error.platforms' };

/* docs/05 section 21 "Rule parameters": `site_settings.videos`. */
export const videoSettingsFormSchema = z.object({
	monthlyLimit: z
		.string(LIMIT_ERROR)
		.trim()
		.regex(/^\d{1,3}$/, LIMIT_ERROR)
		.transform(Number)
		.refine((n) => n >= 1 && n <= 100, LIMIT_ERROR),
	platforms: z
		.array(z.enum(['youtube', 'instagram'], PLATFORMS_ERROR), PLATFORMS_ERROR)
		.min(1, PLATFORMS_ERROR)
});
export type VideoSettingsForm = z.output<typeof videoSettingsFormSchema>;
