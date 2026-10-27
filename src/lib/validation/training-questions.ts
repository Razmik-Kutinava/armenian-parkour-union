import { z } from 'zod';
import type { PortalText } from '#lib/i18n/localized.ts';
import { filledLanguages, portalText, portalTextOptional } from './portal-text';
import { courseFormSchema } from './training';
import { QUESTION_OPTION_ROWS } from './training-enums';

/* Admin "Question bank" and the bank file import (docs/05 section 27; docs/todo.md 9.3, 4 and 7). */

const TEXT_MAX = 1000;
const OPTION_MAX = 300;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const source = z
	.string()
	.trim()
	.max(200, { error: 'auth.error.tooLong' })
	.optional()
	.transform((s) => s || null);

/** The quiz shows one language: each option has every language of the question text. */
function sameLanguages(
	text: PortalText,
	options: { option: PortalText; path: PropertyKey[] }[],
	ctx: z.RefinementCtx
) {
	for (const { option, path } of options) {
		for (const lang of filledLanguages(text)) {
			if (!option[lang]) {
				ctx.addIssue({
					code: 'custom',
					path: [...path, lang],
					message: 'training.error.optionLang'
				});
			}
		}
	}
}

const row = () => portalTextOptional(OPTION_MAX);

/** Six option rows in the form; empty rows are dropped and the correct mark follows its row. */
export const questionFormSchema = z
	.object({
		topicId: z.string().regex(UUID, { error: 'training.error.topic' }),
		text: portalText(TEXT_MAX),
		option0: row(),
		option1: row(),
		option2: row(),
		option3: row(),
		option4: row(),
		option5: row(),
		correct: z.unknown(),
		source
	})
	.transform((v) => {
		const rows = [v.option0, v.option1, v.option2, v.option3, v.option4, v.option5];
		const filled = rows.flatMap((option, n) => (filledLanguages(option).length ? [n] : []));
		const correct = typeof v.correct === 'string' && /^\d$/.test(v.correct) ? +v.correct : -1;
		return { v, rows, filled, correct };
	})
	.superRefine(({ v, rows, filled, correct }, ctx) => {
		if (filled.length < 2) {
			ctx.addIssue({ code: 'custom', path: ['options'], message: 'training.error.options' });
		}
		if (!filled.includes(correct)) {
			ctx.addIssue({ code: 'custom', path: ['correct'], message: 'training.error.correct' });
		}
		const options = filled.map((n) => ({ option: rows[n], path: [`option${n}`] }));
		sameLanguages(v.text, options, ctx);
	})
	.transform(({ v, rows, filled, correct }) => ({
		topicId: v.topicId,
		text: v.text,
		options: filled.map((n) => rows[n]),
		correctIndex: filled.indexOf(correct),
		source: v.source
	}));
export type QuestionValues = z.output<typeof questionFormSchema>;

const bankQuestion = z
	.object({
		text: portalText(TEXT_MAX),
		options: z.array(portalText(OPTION_MAX)).min(2).max(QUESTION_OPTION_ROWS),
		correct: z.number().int(),
		source
	})
	.superRefine((q, ctx) => {
		if (q.correct < 0 || q.correct >= q.options.length) {
			ctx.addIssue({ code: 'custom', path: ['correct'], message: 'training.error.correct' });
		}
		const options = q.options.map((option, i) => ({ option, path: ['options', i] }));
		sameLanguages(q.text, options, ctx);
	})
	.transform(({ correct, ...q }) => ({ ...q, correctIndex: correct }));

/** Prepared from `training/` outside git; the course block is used only when the course is new. */
export const quizBankFileSchema = z.object({
	course: courseFormSchema,
	topics: z
		.array(z.object({ title: portalText(200), questions: z.array(bankQuestion).min(1) }))
		.min(1)
});
export type QuizBankFile = z.output<typeof quizBankFileSchema>;
