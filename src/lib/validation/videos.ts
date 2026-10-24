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
