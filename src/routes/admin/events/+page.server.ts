import { readListState } from '#lib/components/admin/list-state.ts';
import { requirePermission } from '#lib/server/auth/guard.ts';
import { db } from '#lib/server/db/index.ts';
import { eventListOptions, listEventCities, listEvents } from '#lib/server/services/events/list.ts';
import { publicUrl } from '#lib/server/storage/r2.ts';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals, url }) => {
	requirePermission(locals.user, 'events.write');
	const state = readListState(url.searchParams, eventListOptions);
	const [{ rows, total }, cities] = await Promise.all([listEvents(db, state), listEventCities(db)]);
	return {
		state,
		total,
		cities,
		rows: rows.map((r) => ({ ...r, coverUrl: r.coverKey ? publicUrl(r.coverKey) : null }))
	};
};
