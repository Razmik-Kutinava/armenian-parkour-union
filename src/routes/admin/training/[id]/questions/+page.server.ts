import { error } from '@sveltejs/kit';
import { readListState } from '#lib/components/admin/list-state.ts';
import { requirePermission } from '#lib/server/auth/guard.ts';
import { db } from '#lib/server/db/index.ts';
import { listQuestions } from '#lib/server/services/training/question-list.ts';
import { topicChoices } from '../lessons/form';
import type { PageServerLoad } from './$types';

/* docs/05 section 27 "Question bank" (admin): filters — topic, hidden; search in the text. */
const listOptions = {
	sortable: [],
	filters: ['topic', 'state'],
	defaultSort: { key: 'number', dir: 'asc' }
} as const;

export const load: PageServerLoad = async ({ locals, params, url }) => {
	requirePermission(locals.user, 'training.manage');
	const state = readListState(url.searchParams, listOptions);
	const { topic, state: shown } = state.filters;
	const list = await listQuestions(db, params.id, {
		topicId: topic || null,
		state: shown === 'visible' || shown === 'hidden' ? shown : 'all',
		q: state.q
	});
	if (!list) error(404, 'Not found');
	return { ...list, state, topics: await topicChoices(params.id) };
};
