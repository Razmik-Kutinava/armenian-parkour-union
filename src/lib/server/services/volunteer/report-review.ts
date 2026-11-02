import type { LimitDb } from '../../auth/rate-limit';
import type { Mail } from '../../mail/resend';
import type { Actor } from '../users/target';

/* docs/03 section 19.7 p. 3, 19.9: approve awards volunteer_report once; reject needs a note.
 * Stub — RED 10.10. */

export type ReportReviewInput = {
	action: 'approve' | 'reject';
	comment: string;
	/** Shown url or fileKey from the card — refuse `changed` if the member replaced it. */
	shown: string;
};

export type ReportReviewRefusal =
	| 'not_allowed'
	| 'invalid'
	| 'not_found'
	| 'bad_state'
	| 'own'
	| 'changed';

export type ReportReviewResult = { ok: true } | { ok: false; reason: ReportReviewRefusal };

export type ReportReviewDeps = {
	send: (mail: Mail) => Promise<void>;
	siteUrl: string | undefined;
	ip: string | null;
	now?: Date;
};

export async function reviewReport(
	_db: LimitDb,
	_actor: Actor,
	_id: string,
	_input: ReportReviewInput,
	_deps: ReportReviewDeps
): Promise<ReportReviewResult> {
	return { ok: false, reason: 'not_allowed' };
}
