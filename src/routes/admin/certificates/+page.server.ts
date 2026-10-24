import { readListState } from '#lib/components/admin/list-state.ts';
import { roleCan } from '#lib/server/auth/permissions.ts';
import { requirePermission } from '#lib/server/auth/guard.ts';
import { db } from '#lib/server/db/index.ts';
import {
	certificateListOptions,
	listCertificates
} from '#lib/server/services/certificates/index.ts';
import type { PageServerLoad } from './$types';

/* docs/05 section 8: moderator and admin read; only an admin issues. Filters in the URL. */
export const load: PageServerLoad = async ({ locals, url }) => {
	const viewer = requirePermission(locals.user, 'certificates.read');
	const state = readListState(url.searchParams, certificateListOptions);
	const { rows, total } = await listCertificates(db, viewer, state);
	return { state, rows, total, canIssue: roleCan(viewer.role, 'certificates.issue') };
};
