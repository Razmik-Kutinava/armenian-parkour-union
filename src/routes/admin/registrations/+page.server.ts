import { readListState } from '#lib/components/admin/list-state.ts';
import { requirePermission } from '#lib/server/auth/guard.ts';
import { db } from '#lib/server/db/index.ts';
import { eventListOptions, listEvents } from '#lib/server/services/events/list.ts';
import { registrationCounts } from '#lib/server/services/registrations/staff/index.ts';
import type { PageServerLoad } from './$types';

/* docs/05 section 2, "Event registrations": the events with their numbers; moderator and admin. */
export const load: PageServerLoad = async ({ locals, url }) => {
	requirePermission(locals.user, 'registrations.read');
	const state = readListState(url.searchParams, eventListOptions);
	const { rows, total } = await listEvents(db, state);
	const counts = await registrationCounts(
		db,
		rows.map((r) => r.id)
	);
	return {
		state,
		total,
		rows: rows.map(({ id, title, status, startsAt, endsAt, capacity }) => ({
			id,
			title,
			status,
			startsAt,
			endsAt,
			capacity,
			...(counts.get(id) ?? { seats: 0, waitlist: 0 })
		}))
	};
};
