import { error } from '@sveltejs/kit';
import { pickLocalized } from '#lib/i18n/localized.ts';
import { requirePermission } from '#lib/server/auth/guard.ts';
import { db } from '#lib/server/db/index.ts';
import { lessonPdfLink } from '#lib/server/services/training/lesson-files.ts';
import { getLesson } from '#lib/server/services/training/lesson-list.ts';
import { r2Private } from '#lib/server/storage/r2.ts';
import type { PageServerLoad } from './$types';

/* docs/05 section 27: the saved version in any status, as members will see it. HTML was cleaned on save. */
export const load: PageServerLoad = async ({ locals, params }) => {
	requirePermission(locals.user, 'training.lessons');
	const lesson = await getLesson(db, params.id, params.lessonId);
	if (!lesson) error(404, 'Not found');
	const body = lesson.body as Record<string, string | undefined>;
	return {
		lesson: {
			id: lesson.id,
			title: pickLocalized(lesson.title, locals.locale),
			html: body[locals.locale] || body.en || '',
			fileName: lesson.fileName
		},
		pdfUrl: await lessonPdfLink(r2Private, lesson.fileKey)
	};
};
