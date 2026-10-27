import { error, fail } from '@sveltejs/kit';
import type { CourseDetail } from '#lib/server/services/training/course-list.ts';
import { flattenValues, formToObject, settingsErrors } from '#lib/validation/site-settings-form.ts';
import { courseFormSchema } from '#lib/validation/training.ts';

/** The course form, checked on the server (docs/05 section 27). */
export async function readCourseForm(request: Request) {
	const raw = formToObject(await request.formData());
	const parsed = courseFormSchema.safeParse(raw);
	if (parsed.success) return { values: parsed.data, raw };
	return {
		failure: fail(400, { values: flattenValues(raw), errors: settingsErrors(parsed.error) })
	};
}

/** Service refusals: the address as a field error, 403 / 404 for the rest. */
export function refusedCourse(result: string, raw: Record<string, unknown>) {
	if (result === 'not_found') error(404, 'Not found');
	if (result === 'not_allowed') error(403, 'Forbidden');
	return fail(400, {
		values: flattenValues(raw),
		errors: { slug: 'pages.error.slugTaken' as const }
	});
}

/** The saved course as form field values. */
export function courseFormValues(course: CourseDetail): Record<string, string> {
	const number = (n: number | null) => (n === null ? '' : String(n));
	return {
		...flattenValues({ title: course.title, description: course.description }),
		slug: course.slug,
		examKind: course.examKind,
		status: course.status,
		quizSize: number(course.quizSize),
		passCount: number(course.passCount),
		quizMinutes: number(course.quizMinutes),
		retakeDays: number(course.retakeDays),
		attemptsLimit: number(course.attemptsLimit),
		attemptsPeriodDays: number(course.attemptsPeriodDays),
		requiresMembership: course.requiresMembership ? 'on' : '',
		minAge: number(course.minAge),
		requiredLevel: course.requiredLevel ?? ''
	};
}
