import { error } from '@sveltejs/kit';
import { pickPortal } from '#lib/i18n/localized.ts';
import { requireUser } from '#lib/server/auth/guard.ts';
import { db } from '#lib/server/db/index.ts';
import { portalLesson } from '#lib/server/services/training/portal.ts';
import type { PageServerLoad } from './$types';

/* docs/06 section 5.11: one lesson. HTML was cleaned on save; only the page language goes out. */
export const load: PageServerLoad = async ({ locals, params, setHeaders }) => {
	const user = requireUser(locals.user);
	const found = await portalLesson(db, user, params.course, params.id);
	if (!found) error(404, 'Not found');
	setHeaders({ 'cache-control': 'no-store' });
	const { lesson, course, preview } = found;
	return {
		course,
		preview,
		lesson: {
			id: lesson.id,
			title: lesson.title,
			topicTitle: lesson.topicTitle,
			html: pickPortal(lesson.body, locals.locale),
			fileName: lesson.fileName
		}
	};
};
