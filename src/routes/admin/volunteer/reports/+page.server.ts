import { desc, ne } from 'drizzle-orm';
import { readListState } from '#lib/components/admin/list-state.ts';
import { requirePermission } from '#lib/server/auth/guard.ts';
import { db } from '#lib/server/db/index.ts';
import { volunteerRequests } from '#lib/server/db/schema/volunteer-requests.ts';
import {
	listReports,
	reportFilter,
	reportListOptions
} from '#lib/server/services/volunteer/report-list.ts';
import type { PageServerLoad } from './$types';

/* docs/05 section 28 "Reports". */
export const load: PageServerLoad = async ({ locals, url }) => {
	requirePermission(locals.user, 'volunteer.manage');
	const read = readListState(url.searchParams, reportListOptions);
	const filter = reportFilter(read);
	const state = {
		...read,
		filters: { ...read.filters, status: filter.status, request: filter.requestId ?? '' }
	};
	const [{ rows, total }, requests] = await Promise.all([
		listReports(db, filter),
		db
			.select({ id: volunteerRequests.id, title: volunteerRequests.title })
			.from(volunteerRequests)
			.where(ne(volunteerRequests.status, 'draft'))
			.orderBy(desc(volunteerRequests.startsAt))
			.limit(100)
	]);
	return { state, rows, total, requests };
};
