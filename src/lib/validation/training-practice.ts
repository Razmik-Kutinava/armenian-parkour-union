import { z } from 'zod';
import { richTextSchema } from '#lib/server/rich-text/schema.ts';
import { intField } from './events';
import { portalText } from './portal-text';
import type { PostText } from './posts';

/* docs/05 section 27 "Practice tasks" and "Practice"; decisions — docs/todo.md 9.7 (1, 4).
 * No library images in a task: their use is not tracked for tasks, so the cleaner drops them. */

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const keepFilled = (text: Record<string, string | undefined>): PostText => {
	const kept: PostText = {};
	for (const lang of ['en', 'hy', 'ru'] as const) if (text[lang]) kept[lang] = text[lang];
	return kept;
};

const rich = richTextSchema(null).optional();

export const taskFormSchema = z.object({
	title: portalText(200),
	description: z.object({ en: rich, hy: rich, ru: rich }).default({}).transform(keepFilled),
	sortOrder: intField(0, 9999, 'training.error.sortOrder').default(0)
});
export type TaskValues = z.output<typeof taskFormSchema>;

export const taskIdSchema = z.object({ taskId: z.string().regex(UUID) });

/** The member form; the platform and the address are checked by the service. */
export const practiceLinkSchema = z.object({
	taskId: z.string().max(100),
	url: z.string().trim().max(500)
});
