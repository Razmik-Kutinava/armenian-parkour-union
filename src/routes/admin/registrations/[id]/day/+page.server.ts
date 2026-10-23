import { error } from '@sveltejs/kit';
import { requirePermission } from '#lib/server/auth/guard.ts';
import { can } from '#lib/server/auth/permissions.ts';
import { db } from '#lib/server/db/index.ts';
import { getEvent } from '#lib/server/services/events/list.ts';
import {
	eventRoster,
	markAttendance,
	marksOpen,
	RESULTS_OPEN
} from '#lib/server/services/registrations/staff/index.ts';
import { field, refusedResults } from '../outcome';
import type { Actions, PageServerLoad } from './$types';

/* docs/05 section 5 "Event day": moderator and admin read; a mark — registrations.manage. */
export const load: PageServerLoad = async ({ locals, params }) => {
	const viewer = requirePermission(locals.user, 'registrations.read');
	const event = await getEvent(db, params.id);
	if (!event) error(404, 'Not found');
	const rows = await eventRoster(db, event.id);
	if (!rows) error(404, 'Not found');
	const { id, title, status, startsAt, endsAt } = event;
	const open = RESULTS_OPEN.includes(status) && marksOpen(startsAt, new Date());
	return {
		event: { id, title, status, startsAt, endsAt },
		rows,
		open,
		canManage: can(viewer, 'registrations.manage')
	};
};

export const actions: Actions = {
	mark: async ({ locals, params, request, getClientAddress }) => {
		const actor = requirePermission(locals.user, 'registrations.manage');
		const form = await request.formData();
		const ref = {
			eventId: params.id,
			registrationId: field(form, 'registrationId'),
			came: field(form, 'came') === '1'
		};
		const result = await markAttendance(db, actor, ref, getClientAddress());
		return result === 'ok' ? { marked: ref.registrationId } : refusedResults(result);
	}
};
