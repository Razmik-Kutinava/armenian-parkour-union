import { error, fail, type RequestEvent } from '@sveltejs/kit';
import { PUBLIC_SITE_URL } from '$app/env/private';
import { readListState } from '#lib/components/admin/list-state.ts';
import type { MessageKey } from '#lib/i18n/translate.ts';
import { requirePermission } from '#lib/server/auth/guard.ts';
import { db } from '#lib/server/db/index.ts';
import { sendMail } from '#lib/server/mail/index.ts';
import { decideAccess, type DecisionInput } from '#lib/server/services/training/access.ts';
import {
	accessCourses,
	accessFilter,
	accessListOptions,
	listAccess
} from '#lib/server/services/training/access-list.ts';
import type { Actions, PageServerLoad } from './$types';

/* docs/05 section 27 "Requests" (admin): the queue, approve, reject and revoke with a reason. */
export const load: PageServerLoad = async ({ locals, url }) => {
	requirePermission(locals.user, 'training.manage');
	const read = readListState(url.searchParams, accessListOptions);
	const filter = accessFilter(read);
	const state = { ...read, filters: { ...read.filters, status: filter.status } };
	const [{ rows, total }, courses] = await Promise.all([listAccess(db, filter), accessCourses(db)]);
	return { state, rows, total, courses };
};

const REFUSED: Record<'invalid' | 'bad_state', MessageKey> = {
	invalid: 'training.access.error.reason',
	bad_state: 'training.access.error.state'
};

async function decide(event: RequestEvent, action: DecisionInput['action']) {
	const actor = requirePermission(event.locals.user, 'training.manage');
	const form = await event.request.formData();
	const id = String(form.get('accessId') ?? '');
	const reason = String(form.get('comment') ?? '');
	const input: DecisionInput = action === 'approve' ? { action } : { action, reason };
	const result = await decideAccess(db, actor, id, input, {
		send: sendMail,
		siteUrl: PUBLIC_SITE_URL,
		ip: event.getClientAddress()
	});
	if (result.ok) return { done: action };
	if (result.reason === 'not_allowed') error(403, 'Forbidden');
	if (result.reason === 'not_found') error(404, 'Not found');
	if (result.reason === 'conditions') return fail(400, { missing: result.missing });
	return fail(400, { message: REFUSED[result.reason] });
}

export const actions: Actions = {
	approve: (event) => decide(event, 'approve'),
	reject: (event) => decide(event, 'reject'),
	revoke: (event) => decide(event, 'revoke')
};
