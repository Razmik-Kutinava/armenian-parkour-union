import { error } from '@sveltejs/kit';
import { requireUser } from '#lib/server/auth/guard.ts';
import { db } from '#lib/server/db/index.ts';
import { lessonPdfLink } from '#lib/server/services/training/lesson-files.ts';
import { portalLessonPdfKey } from '#lib/server/services/training/portal.ts';
import { r2Private } from '#lib/server/storage/r2.ts';
import type { RequestHandler } from './$types';

/* docs/03 section 18.2 p. 2: the member with access or staff only. The signed link lives 5 minutes,
 * so it is made on the click, not with the page. */
export const GET: RequestHandler = async ({ locals, params }) => {
	const user = requireUser(locals.user);
	const key = await portalLessonPdfKey(db, user, params.course, params.id);
	const link = await lessonPdfLink(r2Private, key);
	if (!link) error(404, 'Not found');
	return new Response(null, {
		status: 303,
		headers: { location: link, 'cache-control': 'no-store' }
	});
};
