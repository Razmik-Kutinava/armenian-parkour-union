import { error, fail, redirect } from '@sveltejs/kit';
import { requirePermission } from '#lib/server/auth/guard.ts';
import { db } from '#lib/server/db/index.ts';
import {
	certificateSettings,
	issuableExams,
	issueCertificateNow
} from '#lib/server/services/certificates/index.ts';
import { examMember, getExamCard } from '#lib/server/services/exams/index.ts';
import { listUsers } from '#lib/server/services/users/list.ts';
import { issueSchema } from '#lib/validation/admin-certificates.ts';
import { fieldErrors, keepValues } from '#lib/validation/form.ts';
import { issueField, issueMessage, PDF_RESULTS } from '../outcome';
import type { Actions, PageServerLoad } from './$types';

const FIELDS = ['kind', 'level', 'category', 'examId', 'issuedAt', 'expiresAt', 'comment'] as const;
const FOUND_MAX = 10;

/** The certificate a passed exam opens (docs/03 sections 3–4). */
const FROM_EXAM = {
	level_advanced: { kind: 'level', level: 'advanced' },
	level_pro: { kind: 'level', level: 'pro' },
	trainer: { kind: 'trainer', level: '' },
	judge: { kind: 'judge', level: '' }
} as const;

/* docs/05 section 8: admin only; find the member (or come from a passed exam), then the form. */
export const load: PageServerLoad = async ({ locals, url }) => {
	const viewer = requirePermission(locals.user, 'certificates.issue');
	const examParam = url.searchParams.get('exam') ?? '';
	const exam = examParam ? await getExamCard(db, examParam) : null;
	const fromExam = exam?.result === 'passed' ? exam : null;
	const memberId = fromExam?.userId ?? url.searchParams.get('member') ?? '';
	const member = memberId ? await examMember(db, viewer, memberId) : null;
	const q = (url.searchParams.get('q') ?? '').trim().slice(0, 200);
	const search = { page: 1, sort: 'name', dir: 'asc' as const, q, filters: {} };
	const found =
		q && !member
			? (await listUsers(db, viewer, search)).rows
					.slice(0, FOUND_MAX)
					.map((r) => ({ id: r.id, name: r.name, level: r.level }))
			: null;
	const exams = member ? await issuableExams(db, member.id) : [];
	const prefill = fromExam
		? { ...FROM_EXAM[fromExam.kind], examId: fromExam.id }
		: { kind: '', level: '', examId: '' };
	return {
		q,
		found,
		member,
		memberMissing: (!!memberId && !member) || (!!examParam && !fromExam),
		exams,
		prefill,
		staffValidMonths: (await certificateSettings(db)).staffValidMonths
	};
};

export const actions: Actions = {
	default: async (event) => {
		const actor = requirePermission(event.locals.user, 'certificates.issue');
		const form = await event.request.formData();
		const values = keepValues(form, FIELDS);
		const parsed = issueSchema().safeParse(Object.fromEntries(form));
		if (!parsed.success) return fail(400, { values, errors: fieldErrors(parsed.error) });
		const result = await issueCertificateNow(db, actor, parsed.data, event.getClientAddress());
		if (result.ok) {
			const pdf = PDF_RESULTS.find((p) => p === result.pdf) ?? 'failed';
			redirect(303, `/admin/certificates/${result.id}?issued=${pdf}`);
		}
		if (result.reason === 'not_allowed') error(403, 'Forbidden');
		const message = issueMessage(result.reason);
		const field = issueField(result.reason);
		if (field) return fail(400, { values, errors: { [field]: message } });
		return fail(400, { values, message });
	}
};
