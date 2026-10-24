import type { MessageKey } from '#lib/i18n/translate.ts';
import type { IssueRefusal, PdfOutcome } from '#lib/server/services/certificates/index.ts';

/* Service refusals → messages (docs/05 section 1, item 11). 403 / 404 are answered by the route. */

export const issueMessage = (reason: Exclude<IssueRefusal, 'not_allowed'>): MessageKey =>
	`certificates.refusal.${reason}`;

const FIELD: Partial<Record<IssueRefusal, string>> = {
	expiry_invalid: 'expiresAt',
	comment_required: 'comment',
	exam_not_found: 'examId',
	exam_mismatch: 'examId',
	exam_not_passed: 'examId'
};

/** The form field a refusal belongs to; the rest go above the form. */
export const issueField = (reason: IssueRefusal) => FIELD[reason] ?? null;

export const PDF_RESULTS = [
	'ok',
	'revoked',
	'assets_missing',
	'storage_missing',
	'site_url_missing',
	'failed'
] as const satisfies readonly (PdfOutcome | 'failed')[];
export type PdfResult = (typeof PDF_RESULTS)[number];

export const pdfMessage = (outcome: PdfResult): MessageKey => `certificates.pdfResult.${outcome}`;
