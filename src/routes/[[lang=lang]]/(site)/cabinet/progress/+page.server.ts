import { error, fail } from '@sveltejs/kit';
import { PUBLIC_SITE_URL } from '$app/env/private';
import type { MessageKey } from '#lib/i18n/translate.ts';
import { requireUser } from '#lib/server/auth/guard.ts';
import { db } from '#lib/server/db/index.ts';
import { sendMail } from '#lib/server/mail/index.ts';
import { getOwnProgress } from '#lib/server/services/cabinet/progress.ts';
import { qrSvg } from '#lib/server/services/certificates/qr-svg.ts';
import { applyForExam, type ApplyExamRefusal } from '#lib/server/services/exams/apply.ts';
import { examSettings } from '#lib/server/services/exams/settings.ts';
import type { Actions, PageServerLoad } from './$types';

/* docs/06 § 5.5; application — docs/04 § 7, session user id only. */

export const load: PageServerLoad = async ({ locals, setHeaders, url }) => {
	const user = requireUser(locals.user);
	setHeaders({ 'cache-control': 'no-store' });
	const progress = await getOwnProgress(db, user.id, await examSettings(db));
	if (!progress) error(404, 'Not found');
	const site = PUBLIC_SITE_URL || url.origin;
	const certificates = progress.certificates.map(({ publicToken, ...cert }) => {
		if (cert.state === 'revoked') return { ...cert, verifyPath: null, verifyUrl: null, qr: null };
		const verifyPath = `/certificate/${publicToken}`;
		const verifyUrl = new URL(verifyPath, site).href;
		return { ...cert, verifyPath, verifyUrl, qr: qrSvg(verifyUrl) };
	});
	return { ...progress, certificates };
};

const REFUSED: Record<ApplyExamRefusal, MessageKey> = {
	not_found: 'cabinet.progress.apply.error.gone',
	blocked: 'cabinet.progress.apply.error.blocked',
	bad_state: 'cabinet.progress.apply.error.state',
	no_exam: 'cabinet.progress.apply.error.noExam',
	level_mismatch: 'cabinet.progress.apply.error.level',
	no_membership: 'cabinet.progress.apply.error.membership',
	already_scheduled: 'cabinet.progress.apply.error.scheduled',
	awaiting_certificate: 'cabinet.progress.apply.error.certificate',
	retake_too_soon: 'cabinet.progress.apply.error.retake',
	level_too_recent: 'cabinet.progress.apply.error.recent'
};

export const actions: Actions = {
	apply: async ({ locals, getClientAddress }) => {
		const user = requireUser(locals.user);
		const settings = await examSettings(db);
		const result = await applyForExam(db, user.id, {
			send: sendMail,
			siteUrl: PUBLIC_SITE_URL,
			ip: getClientAddress(),
			settings
		});
		if (result.ok) return { applied: true as const };
		return fail(400, { message: REFUSED[result.reason] });
	}
};
