import { error } from '@sveltejs/kit';
import { requireUser } from '#lib/server/auth/guard.ts';
import { db } from '#lib/server/db/index.ts';
import { ownCertificatePdfKey } from '#lib/server/services/cabinet/progress.ts';
import { certificatePdfLink } from '#lib/server/services/certificates/card.ts';
import { r2Private } from '#lib/server/storage/r2.ts';
import type { RequestHandler } from './$types';

/* docs/04 section 3.1 "download own certificate", section 5.3: another member's, revoked or not
 * made yet — 404. The signed link lives 5 minutes, so it is made on the click, not with the page. */
export const GET: RequestHandler = async ({ locals, params }) => {
	const user = requireUser(locals.user);
	const key = await ownCertificatePdfKey(db, user.id, params.id);
	const link = key ? await certificatePdfLink(r2Private, key) : null;
	if (!link) error(404, 'Not found');
	return new Response(null, {
		status: 303,
		headers: { location: link, 'cache-control': 'no-store' }
	});
};
