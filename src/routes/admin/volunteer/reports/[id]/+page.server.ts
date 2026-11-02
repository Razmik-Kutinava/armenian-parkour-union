import { error, fail, type RequestEvent } from '@sveltejs/kit';
import { PUBLIC_SITE_URL } from '$app/env/private';
import type { MessageKey } from '#lib/i18n/translate.ts';
import { requirePermission } from '#lib/server/auth/guard.ts';
import { db } from '#lib/server/db/index.ts';
import { sendMail } from '#lib/server/mail/index.ts';
import { reportDetail } from '#lib/server/services/volunteer/report-list.ts';
import {
	reviewReport,
	type ReportReviewInput
} from '#lib/server/services/volunteer/report-review.ts';
import { r2Private } from '#lib/server/storage/r2.ts';
import type { Actions, PageServerLoad } from './$types';

/* docs/05 section 28 "Reports": accept or return; no buttons on one's own. */
export const load: PageServerLoad = async ({ locals, params }) => {
	const viewer = requirePermission(locals.user, 'volunteer.manage');
	const card = await reportDetail(db, params.id, viewer.id, r2Private);
	if (!card) error(404, 'Not found');
	return { card };
};

const REFUSED: Record<'invalid' | 'bad_state' | 'own' | 'changed', MessageKey> = {
	invalid: 'volunteer.reports.error.comment',
	bad_state: 'volunteer.reports.error.state',
	own: 'volunteer.reports.error.own',
	changed: 'volunteer.reports.error.changed'
};

async function decide(event: RequestEvent<{ id: string }>, action: ReportReviewInput['action']) {
	const actor = requirePermission(event.locals.user, 'volunteer.manage');
	const form = await event.request.formData();
	const comment = String(form.get('comment') ?? '');
	const shown = String(form.get('shown') ?? '');
	const result = await reviewReport(
		db,
		actor,
		event.params.id,
		{ action, comment, shown },
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
