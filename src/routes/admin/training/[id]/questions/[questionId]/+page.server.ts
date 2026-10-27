import { error, fail, type RequestEvent } from '@sveltejs/kit';
import { requirePermission } from '#lib/server/auth/guard.ts';
import { db } from '#lib/server/db/index.ts';
import { getQuestion } from '#lib/server/services/training/question-list.ts';
import { setQuestionHidden, updateQuestion } from '#lib/server/services/training/questions.ts';
import { topicChoices } from '../../lessons/form';
import { questionFormValues, readQuestionForm, refusedQuestion } from '../form';
import type { Actions, PageServerLoad } from './$types';

/* docs/05 section 27 "Question bank" (admin): edit, hide / restore; no delete. */
export const load: PageServerLoad = async ({ locals, params }) => {
	requirePermission(locals.user, 'training.manage');
	const question = await getQuestion(db, params.id, params.questionId);
	if (!question) error(404, 'Not found');
	return {
		question: { id: question.id, text: question.text, hidden: question.hiddenAt !== null },
		values: questionFormValues(question),
		topics: await topicChoices(params.id)
	};
};

async function hidden(event: RequestEvent<{ id: string; questionId: string }>, hide: boolean) {
	const actor = requirePermission(event.locals.user, 'training.manage');
	const { id, questionId } = event.params;
	const ip = event.getClientAddress();
	const result = await setQuestionHidden(db, actor, id, questionId, hide, ip);
	if (result === 'not_found') error(404, 'Not found');
	if (result === 'not_allowed') error(403, 'Forbidden');
	if (result === 'bad_state') return fail(400, { stateError: true as const });
	return { saved: true as const };
}

export const actions: Actions = {
	update: async (event) => {
		const actor = requirePermission(event.locals.user, 'training.manage');
		const form = await readQuestionForm(event.request);
		if (form.failure) return form.failure;
		const { id, questionId } = event.params;
		const ip = event.getClientAddress();
		const result = await updateQuestion(db, actor, id, questionId, form.values, ip);
		if (result !== 'ok') return refusedQuestion(result, form.raw);
		return { saved: true as const };
	},
	hide: (event) => hidden(event, true),
	restore: (event) => hidden(event, false)
};
