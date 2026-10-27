import { redirect } from '@sveltejs/kit';
import { requirePermission } from '#lib/server/auth/guard.ts';
import { db } from '#lib/server/db/index.ts';
import { createQuestion } from '#lib/server/services/training/questions.ts';
import { topicChoices } from '../../lessons/form';
import { readQuestionForm, refusedQuestion } from '../form';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals, params }) => {
	requirePermission(locals.user, 'training.manage');
	return { topics: await topicChoices(params.id) };
};

export const actions: Actions = {
	default: async (event) => {
		const actor = requirePermission(event.locals.user, 'training.manage');
		const form = await readQuestionForm(event.request);
		if (form.failure) return form.failure;
		const { id } = event.params;
		const result = await createQuestion(db, actor, id, form.values, event.getClientAddress());
		if (typeof result === 'string') return refusedQuestion(result, form.raw);
		redirect(303, `/admin/training/${id}/questions/${result.id}`);
	}
};
