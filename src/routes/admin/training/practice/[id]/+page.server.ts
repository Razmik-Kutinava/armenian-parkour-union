import { error, fail, type RequestEvent } from '@sveltejs/kit';
import { PUBLIC_SITE_URL } from '$app/env/private';
import type { MessageKey } from '#lib/i18n/translate.ts';
import { requirePermission } from '#lib/server/auth/guard.ts';
import { db } from '#lib/server/db/index.ts';
import { sendMail } from '#lib/server/mail/index.ts';
import { practiceDetail } from '#lib/server/services/training/practice-queue.ts';
import { reviewPractice, type ReviewInput } from '#lib/server/services/training/practice-review.ts';
import type { Actions, PageServerLoad } from './$types';

/* docs/05 section 27 "Practice" (moderator, admin): the video, the task, the history; accept or
 * return with a comment; no buttons on one's own video (the service refuses it too). */
export const load: PageServerLoad = async ({ locals, params }) => {
	const viewer = requirePermission(locals.user, 'training.review');
	const card = await practiceDetail(db, params.id, viewer.id);
	if (!card) error(404, 'Not found');
	return { card };
};

const REFUSED: Record<'invalid' | 'bad_state' | 'own' | 'changed', MessageKey> = {
	invalid: 'training.practice.error.comment',
	bad_state: 'training.practice.error.state',
	own: 'training.practice.error.own',
	changed: 'training.practice.error.changed'
};

async function decide(event: RequestEvent<{ id: string }>, action: ReviewInput['action']) {
	const actor = requirePermission(event.locals.user, 'training.review');
	const form = await event.request.formData();
	const comment = String(form.get('comment') ?? '');
	const url = String(form.get('url') ?? '');
	const result = await reviewPractice(
		db,
		actor,
		event.params.id,
		{ action, comment, url },
		{
			send: sendMail,
			siteUrl: PUBLIC_SITE_URL,
			ip: event.getClientAddress()
		}
	);
	if (result.ok) return { done: action };
	if (result.reason === 'not_allowed') error(403, 'Forbidden');
	if (result.reason === 'not_found') error(404, 'Not found');
	return fail(400, { message: REFUSED[result.reason] });
}

export const actions: Actions = {
	approve: (event) => decide(event, 'approve'),
	reject: (event) => decide(event, 'reject')
};
