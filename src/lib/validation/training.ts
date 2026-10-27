import { z } from 'zod';
import type { MessageKey } from '#lib/i18n/translate.ts';
import { richTextSchema } from '#lib/server/rich-text/schema.ts';
import { intField } from './events';
import { EXAM_KINDS } from './exam-enums';
import { fileName } from './media';
import { slugSchema } from './pages';
import type { PostText } from './posts';
import { portalText, portalTextOptional } from './portal-text';
import {
	COURSE_LEVELS,
	COURSE_LIMITS,
	COURSE_STATUSES,
	LESSON_PDF_MAX_BYTES,
	TOPIC_DIRECTIONS
} from './training-enums';

export { LESSON_PDF_MAX_BYTES };

/* Admin "Training" forms (docs/05 section 27; limits — docs/todo.md 9.2, decisions 2, 5, 6). */

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const emptyToNull = (v: unknown) => (v === '' || v === undefined || v === null ? null : v);
const limit = (key: keyof typeof COURSE_LIMITS, error: MessageKey) =>
	intField(COURSE_LIMITS[key][0], COURSE_LIMITS[key][1], error);

const keepFilled = (text: Record<string, string | undefined>): PostText => {
	const kept: PostText = {};
	for (const lang of ['en', 'hy', 'ru'] as const) if (text[lang]) kept[lang] = text[lang];
	return kept;
};

/* Portal texts: any one language (docs/02 section 11, decisions 2026-10-27). */
export const courseFormSchema = z
	.object({
		slug: slugSchema,
		examKind: z.enum(EXAM_KINDS, { error: 'training.error.examKind' }),
		title: portalText(200),
		description: portalTextOptional(2000),
		status: z.enum(COURSE_STATUSES, { error: 'pages.error.status' }),
		quizSize: limit('quizSize', 'training.error.quizSize'),
		passCount: intField(1, COURSE_LIMITS.quizSize[1], 'training.error.passCount'),
		quizMinutes: limit('quizMinutes', 'training.error.quizMinutes'),
		retakeDays: limit('retakeDays', 'training.error.retakeDays'),
		attemptsLimit: limit('attemptsLimit', 'training.error.attemptsLimit'),
		attemptsPeriodDays: limit('attemptsPeriodDays', 'training.error.attemptsPeriodDays'),
		requiresMembership: z.unknown().transform((v) => v === 'on' || v === true),
		minAge: z.preprocess(emptyToNull, limit('minAge', 'training.error.minAge').nullable()),
		requiredLevel: z.preprocess(
			emptyToNull,
			z.enum(COURSE_LEVELS, { error: 'training.error.level' }).nullable()
		)
	})
	.superRefine((v, ctx) => {
		if (v.passCount > v.quizSize) {
			ctx.addIssue({ code: 'custom', path: ['passCount'], message: 'training.error.passCount' });
		}
	});
export type CourseValues = z.output<typeof courseFormSchema>;

const topicId = z.string().regex(UUID, { error: 'training.error.topic' });

export const topicFormSchema = z.object({ title: portalText(200) });
export type TopicValues = z.output<typeof topicFormSchema>;
export const topicIdSchema = z.object({ topicId });
export const topicMoveSchema = z.object({ topicId, direction: z.enum(TOPIC_DIRECTIONS) });

export const lessonFormSchema = (mediaBaseUrl: string | null) => {
	const rich = richTextSchema(mediaBaseUrl).optional();
	return z.object({
		topicId: z.preprocess(emptyToNull, topicId.nullable()),
		title: portalText(200),
		body: z.object({ en: rich, hy: rich, ru: rich }).default({}).transform(keepFilled),
		sortOrder: intField(0, 9999, 'training.error.sortOrder').default(0),
		status: z.enum(COURSE_STATUSES, { error: 'pages.error.status' })
	});
};
export type LessonValues = z.output<ReturnType<typeof lessonFormSchema>>;

export const lessonPdfSignSchema = z.object({
	mime: z.literal('application/pdf', { error: 'training.error.pdfType' }),
	size: z.coerce
		.number()
		.int()
		.min(1, { error: 'media.error.empty' })
		.max(LESSON_PDF_MAX_BYTES, { error: 'training.error.pdfSize' })
});
export type LessonPdfSign = z.output<typeof lessonPdfSignSchema>;

export const lessonPdfCompleteSchema = z.object({ key: z.string().max(200), name: fileName });
export type LessonPdfComplete = z.output<typeof lessonPdfCompleteSchema>;

const UUID_PART = '[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}';
const PDF_KEY = new RegExp(`^training/(${UUID_PART})/${UUID_PART}\\.pdf$`);

/** `training/<course id>/<uuid>.pdf` (docs/02 section 11): the name never comes from the user. */
export const lessonPdfKey = (courseId: string) => `training/${courseId}/${crypto.randomUUID()}.pdf`;

export const isLessonPdfKey = (courseId: string, key: string) =>
	PDF_KEY.exec(key)?.[1] === courseId;
