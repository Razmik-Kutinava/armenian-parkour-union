import type { ExamRefusal } from './issue-facts';
import type { InputRefusal } from './issue-input';
import type { CertificateLetterDeps } from './mail';
import type { PdfDeps, PdfOutcome } from './pdf-store';
import type { CertificateSettings } from './settings';

/* docs/05 section 8: the issue form and its outcome. */

export type IssueCertificateInput = {
	userId: string;
	kind: 'level' | 'trainer' | 'judge';
	/** Level certificates only. */
	level?: 'advanced' | 'pro' | null;
	/** Coach and judge only. */
	category?: string | null;
	/** Empty — only with a comment (docs/03 section 4.8). */
	examId?: string | null;
	/** Default — now. */
	issuedAt?: Date | null;
	/** Coach and judge; default — `staff_valid_months` from the issue date. */
	expiresAt?: Date | null;
	comment?: string | null;
};

export type IssueRefusal =
	| 'not_allowed'
	| InputRefusal
	| 'user_not_found'
	| 'blocked'
	| ExamRefusal
	| 'already_issued'
	| 'level_skip'
	| 'level_below';

export type IssueCertificateResult =
	| {
			ok: true;
			id: string;
			number: string;
			publicToken: string;
			levelChanged: boolean;
			/** Points awarded; `null` — none (rule off, or the earlier award stands). */
			points: number | null;
			/** The PDF made after the commit (6.4); `null` — not asked for. */
			pdf: PdfOutcome | 'failed' | null;
	  }
	| { ok: false; reason: IssueRefusal };

/** Without `send` no letter goes; without `pdf` no PDF is made. */
export type IssueDeps = {
	settings: CertificateSettings;
	pdf?: PdfDeps;
} & Partial<CertificateLetterDeps>;
