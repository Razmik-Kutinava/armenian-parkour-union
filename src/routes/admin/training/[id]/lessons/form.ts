import { error, fail } from '@sveltejs/kit';
import { R2_PUBLIC_URL } from '$app/env/private';
import type { PortalText } from '#lib/i18n/localized.ts';
import { db } from '#lib/server/db/index.ts';
import type { LessonDetail } from '#lib/server/services/training/lesson-list.ts';
import { listTopics } from '#lib/server/services/training/topics.ts';
import { flattenValues, formToObject, settingsErrors } from '#lib/validation/site-settings-form.ts';
import { lessonFormSchema } from '#lib/validation/training.ts';

/** The lesson form, cleaned on the server: the text is stored as richTextSchema returns it. */
export async function readLessonForm(request: Request) {
	const raw = formToObject(await request.formData());
	const parsed = lessonFormSchema(R2_PUBLIC_URL || null).safeParse(raw);
	if (parsed.success) return { values: parsed.data, raw };
	return {
		failure: fail(400, { values: flattenValues(raw), errors: settingsErrors(parsed.error) })
	};
}

/** Service refusals: a foreign topic as a field error, 403 / 404 for the rest. */
export function refusedLesson(result: string, raw: Record<string, unknown>) {
	if (result === 'not_found') error(404, 'Not found');
	if (result === 'not_allowed') error(403, 'Forbidden');
	return fail(400, {
		values: flattenValues(raw),
		errors: { topicId: 'training.error.topic' as const }
	});
}

/** Topics of the course for the select, hidden ones marked. */
export async function topicChoices(courseId: string) {
	const topics = await listTopics(db, courseId);
	return topics.map((t) => ({
		id: t.id,
		title: t.title as PortalText,
		hidden: t.hiddenAt !== null
	}));
}

export function lessonFormValues(lesson: LessonDetail): Record<string, string> {
	return {
		...flattenValues({ title: lesson.title, body: lesson.body }),
		topicId: lesson.topicId ?? '',
		sortOrder: String(lesson.sortOrder),
		status: lesson.status
	};
}
