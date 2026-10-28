import { error, fail } from '@sveltejs/kit';
import { PUBLIC_SITE_URL } from '$app/env/private';
import { requireUser } from '#lib/server/auth/guard.ts';
import { db } from '#lib/server/db/index.ts';
import { sendMail } from '#lib/server/mail/index.ts';
import { quizPage } from '#lib/server/services/training/quiz-read.ts';
import { startAttempt } from '#lib/server/services/training/quiz-start.ts';
import { saveAnswers, submitAttempt } from '#lib/server/services/training/quiz-submit.ts';
import type { Actions, PageServerLoad } from './$types';

/* docs/06 section 5.11 "Quiz": own attempts only — the member comes from the session, the attempt
 * id is checked against them; no access and no course look the same — 404. */

const deps = () => ({ send: sendMail, siteUrl: PUBLIC_SITE_URL });

export const load: PageServerLoad = async ({ locals, params, setHeaders }) => {
	const user = requireUser(locals.user);
	const quiz = await quizPage(db, user, params.course, deps());
	if (!quiz) error(404, 'Not found');
	setHeaders({ 'cache-control': 'no-store' });
	return { quiz };
};

/** `q0`, `q1`, … → answers in the order of the questions. */
async function readForm(request: Request) {
	const form = await request.formData();
	const answers: unknown[] = [];
	for (const [key, value] of form) {
		const match = /^q(\d{1,3})$/.exec(key);
		if (match) answers[Number(match[1])] = value;
	}
	return { attemptId: String(form.get('attemptId') ?? ''), answers };
}

export const actions: Actions = {
	start: async ({ locals, params }) => {
		const user = requireUser(locals.user);
		const result = await startAttempt(db, user, params.course, deps());
		if (result.ok) return { started: true as const };
		if (result.reason === 'not_found') error(404, 'Not found');
		return fail(400, { message: 'cabinet.quiz.error.start' as const });
	},
	save: async ({ locals, params, request }) => {
		const user = requireUser(locals.user);
		const { attemptId, answers } = await readForm(request);
		const result = await saveAnswers(db, user, params.course, attemptId, answers, deps());
		if (result.ok) return { saved: true as const };
		if (result.reason === 'not_found') error(404, 'Not found');
		return fail(409, { message: 'cabinet.quiz.error.closed' as const });
	},
	submit: async ({ locals, params, request }) => {
		const user = requireUser(locals.user);
		const { attemptId, answers } = await readForm(request);
		const result = await submitAttempt(db, user, params.course, attemptId, answers, deps());
		if (!result.ok) error(404, 'Not found');
		return { result: { ...result } };
	}
};
