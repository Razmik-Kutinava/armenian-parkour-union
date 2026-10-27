import { error, redirect } from '@sveltejs/kit';
import { requirePermission } from '#lib/server/auth/guard.ts';
import { db } from '#lib/server/db/index.ts';
import { lessonPdfLink } from '#lib/server/services/training/lesson-files.ts';
import { getLesson } from '#lib/server/services/training/lesson-list.ts';
import { deleteLesson, updateLesson } from '#lib/server/services/training/lessons.ts';
import { r2Private } from '#lib/server/storage/r2.ts';
import { lessonFormValues, readLessonForm, refusedLesson, topicChoices } from '../form';
import { pdfActions } from './pdf-actions';
import type { Actions, PageServerLoad } from './$types';

/* docs/05 section 27 "Lessons" (training.lessons): the form, the PDF, delete. */
export const load: PageServerLoad = async ({ locals, params }) => {
	requirePermission(locals.user, 'training.lessons');
	const lesson = await getLesson(db, params.id, params.lessonId);
	if (!lesson) error(404, 'Not found');
	return {
		lesson: { id: lesson.id, title: lesson.title, fileName: lesson.fileName },
		values: lessonFormValues(lesson),
		topics: await topicChoices(params.id),
		pdfUrl: await lessonPdfLink(r2Private, lesson.fileKey)
	};
};

export const actions: Actions = {
	update: async (event) => {
		const actor = requirePermission(event.locals.user, 'training.lessons');
		const form = await readLessonForm(event.request);
		if (form.failure) return form.failure;
		const { id, lessonId } = event.params;
		const ip = event.getClientAddress();
		const result = await updateLesson(db, actor, id, lessonId, form.values, ip);
		if (result !== 'ok') return refusedLesson(result, form.raw);
		return { saved: true };
	},
	delete: async (event) => {
		const actor = requirePermission(event.locals.user, 'training.lessons');
		const { id, lessonId } = event.params;
		const result = await deleteLesson(db, actor, id, lessonId, event.getClientAddress());
		if (result === 'not_allowed') error(403, 'Forbidden');
		if (result !== 'ok') error(404, 'Not found');
		redirect(303, `/admin/training/${id}/lessons`);
	},
	...pdfActions
};
