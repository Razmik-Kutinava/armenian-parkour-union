import type { exams } from '../../db/schema/certification';
import type { users } from '../../db/schema/users';
import type { ExamSettings } from './settings';

/* docs/03 section 3.3, 4.2; docs/05 section 7: hard conditions refuse; a level that does not fit
 * only warns — a skipped level is stopped when the certificate is issued (docs/03 section 3.1). */

export type ExamKind = (typeof exams.$inferSelect)['kind'];
type Level = (typeof users.$inferSelect)['level'];

export type ExamRefusal =
	| 'blocked'
	| 'no_membership'
	| 'already_scheduled'
	| 'awaiting_certificate'
	| 'retake_too_soon'
	| 'level_too_recent';

export type ExamWarning = 'level_mismatch';

export type ExamAdmissionInput = {
	/** The exam date: waiting periods are counted to it. */
	at: Date;
	kind: ExamKind;
	user: { status: (typeof users.$inferSelect)['status']; level: Level };
	membershipActive: boolean;
	/** An exam of this kind is already scheduled. */
	scheduled: boolean;
	/** An exam of this kind is passed and has no certificate yet. */
	awaitingCertificate: boolean;
	/** `decided_at` of the last failed exam of this kind. */
	lastFailedAt: Date | null;
	/** Since when the member holds the current level; `null` — unknown. */
	levelSince: Date | null;
	settings: ExamSettings;
};

const DAY = 86_400_000;

/** The level an exam of this kind is taken from; `undefined` — not a level exam. */
export const LEVEL_BEFORE: Partial<Record<ExamKind, Level>> = {
	level_advanced: 'novice',
	level_pro: 'advanced'
};

const tooSoon = (since: Date | null, days: number, at: Date) =>
	days > 0 && since !== null && at.getTime() < since.getTime() + days * DAY;

function refusal(i: ExamAdmissionInput): ExamRefusal | null {
	if (i.user.status !== 'active') return 'blocked';
	if (!i.membershipActive) return 'no_membership';
	if (i.scheduled) return 'already_scheduled';
	if (i.awaitingCertificate) return 'awaiting_certificate';
	if (tooSoon(i.lastFailedAt, i.settings.retakeDays, i.at)) return 'retake_too_soon';
	const fits = LEVEL_BEFORE[i.kind] !== undefined && LEVEL_BEFORE[i.kind] === i.user.level;
	if (fits && tooSoon(i.levelSince, i.settings.minDaysOnLevel, i.at)) return 'level_too_recent';
	return null;
}

export function checkExamAdmission(i: ExamAdmissionInput): {
	refusal: ExamRefusal | null;
	warnings: ExamWarning[];
} {
	const needed = LEVEL_BEFORE[i.kind];
	const warnings: ExamWarning[] =
		needed !== undefined && needed !== i.user.level ? ['level_mismatch'] : [];
	return { refusal: refusal(i), warnings };
}
