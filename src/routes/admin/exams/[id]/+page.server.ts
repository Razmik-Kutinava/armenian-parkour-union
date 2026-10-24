import { error, fail } from '@sveltejs/kit';
import type { MessageKey } from '#lib/i18n/translate.ts';
import { roleCan } from '#lib/server/auth/permissions.ts';
import { requirePermission } from '#lib/server/auth/guard.ts';
import { db } from '#lib/server/db/index.ts';
import { certificateOfExam } from '#lib/server/services/certificates/index.ts';
import { getExamCard, recordExamResult } from '#lib/server/services/exams/index.ts';
import { resultSchema } from '#lib/validation/admin-exams.ts';
import { fieldErrors, keepValues } from '#lib/validation/form.ts';
import { resultMessage } from '../outcome';
import type { Actions, PageServerLoad } from './$types';

const FIELDS = ['result', 'score', 'comment'] as const;

/* docs/05 sections 7–8: the card and the result; moderator and admin. A passed exam shows its
 * certificate, or to an admin the way to issue it. */
export const load: PageServerLoad = async ({ locals, params }) => {
	const viewer = requirePermission(locals.user, 'exams.manage');
	const card = await getExamCard(db, params.id);
	if (!card) error(404, 'Not found');
	const certificate = card.result === 'passed' ? await certificateOfExam(db, card.id) : null;
	return { card, certificate, canIssue: roleCan(viewer.role, 'certificates.issue') };
};

export const actions: Actions = {
	result: async ({ locals, params, request, getClientAddress }) => {
		const actor = requirePermission(locals.user, 'exams.manage');
		const form = await request.formData();
		const values = keepValues(form, FIELDS);
		const parsed = resultSchema.safeParse(Object.fromEntries(form));
		if (!parsed.success) return fail(400, { values, errors: fieldErrors(parsed.error) });
		const input = { examId: params.id, ...parsed.data };
		const outcome = await recordExamResult(db, actor, input, getClientAddress());
		if (outcome === 'not_found') error(404, 'Not found');
		if (outcome === 'not_allowed') error(403, 'Forbidden');
		if (outcome === 'ok') return { done: 'exams.saved' as MessageKey };
		return fail(400, { values, message: resultMessage(outcome) });
	}
};
