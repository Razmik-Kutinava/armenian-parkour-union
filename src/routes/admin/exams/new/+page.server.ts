import { error, fail, redirect } from '@sveltejs/kit';
import { roleCan } from '#lib/server/auth/permissions.ts';
import { requirePermission } from '#lib/server/auth/guard.ts';
import { db } from '#lib/server/db/index.ts';
import {
	examEventOptions,
	examinerOptions,
	examMember,
	scheduleExamNow
} from '#lib/server/services/exams/index.ts';
import { listUsers } from '#lib/server/services/users/list.ts';
import { scheduleSchema } from '#lib/validation/admin-exams.ts';
import { EXAM_KINDS } from '#lib/validation/exam-enums.ts';
import { fieldErrors, keepValues } from '#lib/validation/form.ts';
import { scheduleField, scheduleMessage } from '../outcome';
import type { Actions, PageServerLoad } from './$types';

const FIELDS = ['kind', 'scheduledAt', 'eventId', 'examinerId', 'notes'] as const;
const FOUND_MAX = 10;

/* docs/05 section 7: find the member (names only; email search — admin), then the form. */
export const load: PageServerLoad = async ({ locals, url }) => {
	const viewer = requirePermission(locals.user, 'exams.manage');
	const q = (url.searchParams.get('q') ?? '').trim().slice(0, 200);
	const memberId = url.searchParams.get('member') ?? '';
	const member = memberId ? await examMember(db, viewer, memberId) : null;
	const search = { page: 1, sort: 'name', dir: 'asc' as const, q, filters: {} };
	const found =
		q && !member
			? (await listUsers(db, viewer, search)).rows
					.slice(0, FOUND_MAX)
					.map((r) => ({ id: r.id, name: r.name, level: r.level }))
			: null;
	const [examiners, events] = member
		? await Promise.all([examinerOptions(db), examEventOptions(db, new Date())])
		: [[], []];
	const kind = EXAM_KINDS.find((k) => k === url.searchParams.get('kind')) ?? '';
	const fullSearch = roleCan(viewer.role, 'users.read_full');
	return {
		q,
		found,
		member,
		memberMissing: !!memberId && !member,
		kind,
		examiners,
		events,
		fullSearch
	};
};

export const actions: Actions = {
	default: async (event) => {
		const actor = requirePermission(event.locals.user, 'exams.manage');
		const form = await event.request.formData();
		const values = keepValues(form, FIELDS);
		const parsed = scheduleSchema.safeParse(Object.fromEntries(form));
		if (!parsed.success) return fail(400, { values, errors: fieldErrors(parsed.error) });
		const result = await scheduleExamNow(db, actor, parsed.data, event.getClientAddress());
		if (result.ok) redirect(303, `/admin/exams/${result.id}`);
		if (result.reason === 'not_allowed') error(403, 'Forbidden');
		const { warnings } = result;
		if (result.reason === 'confirm_level') return fail(400, { values, warnings });
		const message = scheduleMessage(result.reason);
		const field = scheduleField(result.reason);
		if (field) return fail(400, { values, warnings, errors: { [field]: message } });
		return fail(400, { values, warnings, message });
	}
};
