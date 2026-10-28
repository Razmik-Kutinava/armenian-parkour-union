import { fail } from '@sveltejs/kit';
import { PUBLIC_SITE_URL } from '$app/env/private';
import type { MessageKey } from '#lib/i18n/translate.ts';
import { requireUser } from '#lib/server/auth/guard.ts';
import { db } from '#lib/server/db/index.ts';
import { sendMail } from '#lib/server/mail/index.ts';
import { applyForCourse } from '#lib/server/services/training/access.ts';
import { cabinetCourses } from '#lib/server/services/training/cabinet-courses.ts';
import type { Actions, PageServerLoad } from './$types';

/* docs/06 section 5.11 "Course list": own requests only — the member id comes from the session. */

export const load: PageServerLoad = async ({ locals, setHeaders }) => {
	const user = requireUser(locals.user);
	setHeaders({ 'cache-control': 'no-store' });
	return { courses: await cabinetCourses(db, user.id) };
};

const REFUSED: Record<'not_found' | 'blocked' | 'bad_state' | 'conditions', MessageKey> = {
	not_found: 'cabinet.training.error.gone',
	blocked: 'cabinet.training.error.blocked',
	bad_state: 'cabinet.training.error.state',
	conditions: 'cabinet.training.error.conditions'
};

export const actions: Actions = {
	apply: async ({ locals, request, getClientAddress }) => {
		const user = requireUser(locals.user);
		const courseId = String((await request.formData()).get('courseId') ?? '');
		const result = await applyForCourse(db, user.id, courseId, {
			send: sendMail,
			siteUrl: PUBLIC_SITE_URL,
			ip: getClientAddress()
		});
		if (result.ok) return { courseId, applied: true as const };
		return fail(400, { courseId, message: REFUSED[result.reason] });
	}
};
