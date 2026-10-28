import { error, fail } from '@sveltejs/kit';
import { requireUser } from '#lib/server/auth/guard.ts';
import { db } from '#lib/server/db/index.ts';
import { practicePage } from '#lib/server/services/training/practice-read.ts';
import { submitPractice } from '#lib/server/services/training/practice-submit.ts';
import { practiceLinkSchema } from '#lib/validation/training-practice.ts';
import type { Actions, PageServerLoad } from './$types';

/* docs/06 section 5.11 "Practice": own submissions only — the member comes from the session;
 * no access and no course look the same — 404. */
export const load: PageServerLoad = async ({ locals, params, setHeaders }) => {
	const user = requireUser(locals.user);
	const practice = await practicePage(db, user, params.course);
	if (!practice) error(404, 'Not found');
	setHeaders({ 'cache-control': 'no-store' });
	return { practice };
};

export const actions: Actions = {
	submit: async ({ locals, params, request }) => {
		const user = requireUser(locals.user);
		const parsed = practiceLinkSchema.safeParse(Object.fromEntries(await request.formData()));
		if (!parsed.success) error(404, 'Not found');
		const { taskId, url } = parsed.data;
		const result = await submitPractice(db, user, params.course, taskId, url);
		if (result.ok)
			return { taskId, sent: result.replaced ? ('replaced' as const) : ('sent' as const) };
		if (result.reason === 'not_found') error(404, 'Not found');
		return fail(400, { taskId, url, error: result.reason });
	}
};
