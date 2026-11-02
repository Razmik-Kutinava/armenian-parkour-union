import type { LimitDb } from '../../auth/rate-limit';
import type { PrivateStorage } from '../../storage/types';

/* docs/03 section 19.7 p. 2: after attended — photo or link + note. Stub — RED 10.10. */

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
	| { ok: true; id: string; replaced: boolean }
	| { ok: false; reason: ReportSubmitRefusal };

export async function submitReport(
	_db: LimitDb,
	_userId: string,
	_input: ReportSubmitInput,
	_storage: PrivateStorage | null = null
): Promise<ReportSubmitResult> {
	return { ok: false, reason: 'not_found' };
}

export async function signReportUpload(
	_db: LimitDb,
	_storage: PrivateStorage,
	_userId: string,
	_req: { mime: string; size: number }
): Promise<{ key: string; url: string } | ReportSubmitRefusal> {
	return 'not_found';
}
