import { z } from 'zod';
import type { MessageKey } from '#lib/i18n/translate.ts';
import { EXAM_DECISIONS, EXAM_KINDS, EXAM_TEXT_MAX } from './exam-enums';
import { yerevanDateTime } from './posts';

/* Admin forms "Exams" (docs/05 section 7). Messages are i18n keys; the service checks admission. */

const optionalId = (error: MessageKey) =>
	z
		.string()
		.trim()
		.optional()
		.transform((v) => v || null)
		.pipe(z.uuid({ error }).nullable());

const text = z
	.string()
	.trim()
	.max(EXAM_TEXT_MAX, { error: 'auth.error.tooLong' })
	.optional()
	.transform((v) => v || null);

export const scheduleSchema = z.object({
	userId: z.uuid({ error: 'exams.error.member' }),
	kind: z.enum(EXAM_KINDS, { error: 'exams.error.kind' }),
	scheduledAt: yerevanDateTime('exams.error.date'),
	eventId: optionalId('exams.error.event'),
	examinerId: optionalId('exams.error.examiner'),
	notes: text,
	/** A checkbox: present — the staff saw the level warning. */
	confirmLevel: z
		.string()
		.optional()
		.transform((v) => v !== undefined && v !== '')
});

/** 0–999.99, up to two decimals; a comma is a decimal point too. */
const SCORE = /^\d{1,3}([.,]\d{1,2})?$/;

export const resultSchema = z
	.object({
		result: z.enum(EXAM_DECISIONS, { error: 'exams.error.result' }),
		score: z
			.string()
			.trim()
			.optional()
			.refine((v) => !v || SCORE.test(v), { error: 'exams.error.score' })
			.transform((v) => (v ? Number(v.replace(',', '.')) : null)),
		comment: text
	})
	.superRefine((v, ctx) => {
		if (v.result === 'cancelled' && v.score !== null) {
			ctx.addIssue({ code: 'custom', path: ['score'], message: 'exams.error.scoreCancelled' });
		}
	});
