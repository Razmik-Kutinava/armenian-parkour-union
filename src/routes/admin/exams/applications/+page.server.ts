import { fail } from '@sveltejs/kit';
import { PUBLIC_SITE_URL } from '$app/env/private';
import { readListState } from '#lib/components/admin/list-state.ts';
import type { MessageKey } from '#lib/i18n/translate.ts';
import { requirePermission } from '#lib/server/auth/guard.ts';
import { db } from '#lib/server/db/index.ts';
import { sendMail } from '#lib/server/mail/index.ts';
import { rejectExamApplication } from '#lib/server/services/exams/application-decide.ts';
import {
	applicationListOptions,
	listExamApplications
} from '#lib/server/services/exams/list-applications.ts';
import type { Actions, PageServerLoad } from './$types';

/* Exam application queue (docs/todo.md debt stage 6). */

export const load: PageServerLoad = async ({ locals, url }) => {
	const viewer = requirePermission(locals.user, 'exams.manage');
	const read = readListState(url.searchParams, applicationListOptions);
	if (!read.filters.status) read.filters = { ...read.filters, status: 'pending' };
	const { rows, total } = await listExamApplications(db, viewer, read);
	return { state: read, rows, total };
};

const REFUSED: Record<'not_allowed' | 'invalid' | 'not_found' | 'bad_state', MessageKey> = {
	not_allowed: 'exams.applications.error.forbidden',
	invalid: 'exams.applications.error.reason',
	not_found: 'exams.applications.error.gone',
	bad_state: 'exams.applications.error.state'
};

export const actions: Actions = {
	reject: async (event) => {
		const actor = requirePermission(event.locals.user, 'exams.manage');
		const form = await event.request.formData();
		const id = String(form.get('id') ?? '');
		const reason = String(form.get('comment') ?? '');
		const result = await rejectExamApplication(
			db,
			actor,
			id,
			{ reason },
			{ send: sendMail, siteUrl: PUBLIC_SITE_URL, ip: event.getClientAddress() }
		);
		if (result.ok) return { done: 'rejected' as const };
		return fail(400, { message: REFUSED[result.reason] });
	}
};
