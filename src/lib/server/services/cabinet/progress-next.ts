import type { LimitDb } from '../../auth/rate-limit';
import type { MembershipLevel } from '../../auth/session';
import { checkExamAdmission, type ExamKind, type ExamRefusal } from '../exams/admission';
import { ownApplicationFor } from '../exams/application-own';
import { readExamFacts } from '../exams/facts';
import type { ExamSettings } from '../exams/settings';

/* docs/06 § 5.5 next step + cabinet exam application (docs/04 § 7). */

export type ApplicationView = {
	status: 'pending' | 'rejected';
	reviewNote: string | null;
};

export type NextStep =
	| { step: 'join' }
	| { step: 'top' }
	| {
			step: 'exam';
			kind: ExamKind;
			refusal: ExamRefusal | null;
			availableFrom: Date | null;
			application: ApplicationView | null;
			canApply: boolean;
	  };

const NEXT_EXAM: Record<MembershipLevel, ExamKind | null> = {
	novice: 'level_advanced',
	advanced: 'level_pro',
	pro: null
};

const DAY = 86_400_000;
const after = (since: Date | null, days: number) =>
	since ? new Date(since.getTime() + days * DAY) : null;

export async function nextLevelStep(
	db: LimitDb,
	userId: string,
	user: { status: 'active' | 'blocked'; level: MembershipLevel | null },
	settings: ExamSettings,
	now: Date
): Promise<NextStep> {
	if (!user.level) return { step: 'join' };
	const kind = NEXT_EXAM[user.level];
	if (!kind) return { step: 'top' };
	const facts = await readExamFacts(db, userId, kind, user.level, settings, now);
	const { refusal, warnings } = checkExamAdmission({ at: now, kind, user, settings, ...facts });
	const availableFrom =
		refusal === 'retake_too_soon'
			? after(facts.lastFailedAt, settings.retakeDays)
			: refusal === 'level_too_recent'
				? after(facts.levelSince, settings.minDaysOnLevel)
				: null;
	const application = await ownApplicationFor(db, userId, kind);
	const mismatch = warnings.includes('level_mismatch');
	const canApply =
		!refusal && !mismatch && application?.status !== 'pending' && user.status === 'active';
	return { step: 'exam', kind, refusal, availableFrom, application, canApply };
}
