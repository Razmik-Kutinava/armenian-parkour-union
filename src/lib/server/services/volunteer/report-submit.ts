import { and, eq, inArray } from 'drizzle-orm';
import type { ReportUploadRequest } from '#lib/validation/volunteer-report.ts';
import type { LimitDb } from '../../auth/rate-limit';
import { volunteerInvitations, volunteerReports } from '../../db/schema/volunteer-requests';
import type { PrivateStorage } from '../../storage/types';
import { isUuid } from '../users/target';
import { checkReportFile, signReportUpload as signUpload } from './report-files';
import { normalizeReportUrl } from './report-link';

/* docs/03 section 19.7 p. 2: after attended — photo or link + note; one live row; pending replaced. */

export type ReportSubmitInput = {
	invitationId: string;
	note?: string;
	url?: string;
	key?: string;
};

export type ReportSubmitRefusal =
	| 'not_found'
	| 'not_attended'
	| 'bad_input'
	| 'bad_url'
	| 'bad_key'
	| 'missing'
	| 'too_large'
	| 'bad_type'
	| 'bad_state'
	| 'limited';

export type ReportSubmitResult =
	{ ok: true; id: string; replaced: boolean } | { ok: false; reason: ReportSubmitRefusal };

const NOTE_MAX = 1000;
const refuse = (reason: ReportSubmitRefusal) => ({ ok: false, reason }) as const;

export async function signReportUpload(
	db: LimitDb,
	storage: PrivateStorage,
	userId: string,
	req: ReportUploadRequest
) {
	return signUpload(db, storage, userId, req);
}

export async function submitReport(
	db: LimitDb,
	userId: string,
	input: ReportSubmitInput,
	storage: PrivateStorage | null = null
): Promise<ReportSubmitResult> {
	if (!isUuid(userId) || !isUuid(input.invitationId)) return refuse('not_found');
	const note = input.note?.trim() || null;
	if ((note?.length ?? 0) > NOTE_MAX) return refuse('bad_input');
	const hasUrl = Boolean(input.url?.trim());
	const hasKey = Boolean(input.key?.trim());
	if (hasUrl === hasKey) return refuse('bad_input');

	let url: string | null = null;
	let fileKey: string | null = null;
	if (hasUrl) {
		url = normalizeReportUrl(input.url!);
		if (!url) return refuse('bad_url');
	} else {
		if (!storage) return refuse('missing');
		const checked = await checkReportFile(storage, userId, input.key!.trim());
		if (!checked.ok) return refuse(checked.reason);
		fileKey = checked.key;
	}

	return db.transaction(async (tx): Promise<ReportSubmitResult> => {
		const [invite] = await tx
			.select({
				id: volunteerInvitations.id,
				userId: volunteerInvitations.userId,
				status: volunteerInvitations.status
			})
			.from(volunteerInvitations)
			.where(
				and(
					eq(volunteerInvitations.id, input.invitationId),
					eq(volunteerInvitations.userId, userId)
				)
			)
			.for('update');
		if (!invite) return refuse('not_found');
		if (invite.status !== 'attended') return refuse('not_attended');

		const [live] = await tx
			.select({ id: volunteerReports.id, status: volunteerReports.status })
			.from(volunteerReports)
			.where(
				and(
					eq(volunteerReports.invitationId, invite.id),
					inArray(volunteerReports.status, ['pending', 'approved'])
				)
			)
			.for('update');
		if (live?.status === 'approved') return refuse('bad_state');
		const values = { url, fileKey, note };
		if (live) {
			await tx.update(volunteerReports).set(values).where(eq(volunteerReports.id, live.id));
			return { ok: true, id: live.id, replaced: true };
		}
		const [row] = await tx
			.insert(volunteerReports)
			.values({ invitationId: invite.id, userId, ...values })
			.returning({ id: volunteerReports.id });
		return { ok: true, id: row.id, replaced: false };
	});
}
