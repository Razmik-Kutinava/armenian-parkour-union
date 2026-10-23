import { error, fail } from '@sveltejs/kit';
import type { MessageKey } from '#lib/i18n/translate.ts';
import { requirePermission } from '#lib/server/auth/guard.ts';
import { can } from '#lib/server/auth/permissions.ts';
import { db } from '#lib/server/db/index.ts';
import { changeEventStatus } from '#lib/server/services/events/lifecycle.ts';
import { getEvent } from '#lib/server/services/events/list.ts';
import {
	eventRoster,
	RESULTS_OPEN,
	saveResults
} from '#lib/server/services/registrations/staff/index.ts';
import { RESULT_ROWS_MAX } from '#lib/validation/registration-results.ts';
import { done, field, refusedResults } from '../outcome';
import type { Actions, PageServerLoad } from './$types';

/* docs/05 section 5 "Results": places and scores — registrations.manage; "Finish the event" —
 * events.cancel (admin, as the finish button of 2.5). */
export const load: PageServerLoad = async ({ locals, params }) => {
	const viewer = requirePermission(locals.user, 'registrations.read');
	const event = await getEvent(db, params.id);
	if (!event) error(404, 'Not found');
	const roster = await eventRoster(db, event.id);
	if (!roster) error(404, 'Not found');
	const { id, title, status, startsAt, endsAt } = event;
	return {
		event: { id, title, status, startsAt, endsAt },
		rows: roster.filter((r) => r.status === 'attended'),
		unmarked: roster.filter((r) => r.status === 'registered').length,
		canManage: can(viewer, 'registrations.manage') && RESULTS_OPEN.includes(status),
		canFinish: can(viewer, 'events.cancel') && status === 'published' && startsAt <= new Date()
	};
};

export const actions: Actions = {
	save: async ({ locals, params, request, getClientAddress }) => {
		const actor = requirePermission(locals.user, 'registrations.manage');
		const form = await request.formData();
		const ids = form
			.getAll('registrationId')
			.slice(0, RESULT_ROWS_MAX + 1)
			.map(String);
		const rows = ids.map((id) => ({
			registrationId: id,
			place: field(form, `place.${id}`),
			score: field(form, `score.${id}`)
		}));
		const result = await saveResults(db, actor, { eventId: params.id, rows }, getClientAddress());
		return result === 'ok' ? done('registrationsAdmin.done.results') : refusedResults(result);
	},
	finish: async ({ locals, params, getClientAddress }) => {
		const actor = requirePermission(locals.user, 'events.cancel');
		const result = await changeEventStatus(db, actor, params.id, 'finish', getClientAddress());
		if (result === 'not_found') error(404, 'Not found');
		if (result === 'not_allowed') error(403, 'Forbidden');
		if (result === 'bad_status') {
			return fail(400, { message: 'registrationsAdmin.error.finish' as MessageKey });
		}
		return done('registrationsAdmin.done.finished');
	}
};
