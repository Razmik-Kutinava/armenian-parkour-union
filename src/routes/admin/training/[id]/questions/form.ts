import { error, fail } from '@sveltejs/kit';
import type { QuestionDetail } from '#lib/server/services/training/question-list.ts';
import { flattenValues, formToObject, settingsErrors } from '#lib/validation/site-settings-form.ts';
import { questionFormSchema } from '#lib/validation/training-questions.ts';

/** Option rows are `option0.ru` … `option5.en` and `correct` is the row number. */
export async function readQuestionForm(request: Request) {
	const raw = formToObject(await request.formData());
	const parsed = questionFormSchema.safeParse(raw);
	if (parsed.success) return { values: parsed.data, raw };
	return {
		failure: fail(400, { values: flattenValues(raw), errors: settingsErrors(parsed.error) })
	};
}

/** Service refusals: a foreign topic as a field error, 403 / 404 for the rest. */
export function refusedQuestion(result: string, raw: Record<string, unknown>) {
	if (result === 'not_found') error(404, 'Not found');
	if (result === 'not_allowed') error(403, 'Forbidden');
	return fail(400, {
		values: flattenValues(raw),
		errors: { topicId: 'training.error.topic' as const }
	});
}

export function questionFormValues(question: QuestionDetail): Record<string, string> {
	const rows = Object.fromEntries(question.options.map((option, n) => [`option${n}`, option]));
	return {
		...flattenValues({ text: question.text, ...rows }),
		topicId: question.topicId,
		correct: String(question.correctIndex),
		source: question.source ?? ''
	};
}
