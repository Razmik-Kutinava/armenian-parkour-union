import type { LimitDb } from '../../auth/rate-limit';
import type { MembershipLevel } from '../../auth/session';
import { checkExamAdmission, type ExamKind, type ExamRefusal } from '../exams/admission';
import { readExamFacts } from '../exams/facts';
import type { ExamSettings } from '../exams/settings';

/* docs/06 section 5.1 "next step" on the progress page: which level exam is open (docs/03 section
 * 3.3). The federation schedules exams — there is no application by the member yet. */

export type NextStep =
	| { step: 'join' }
	| { step: 'top' }
	| { step: 'exam'; kind: ExamKind; refusal: ExamRefusal | null; availableFrom: Date | null };

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
	const { refusal } = checkExamAdmission({ at: now, kind, user, settings, ...facts });
	const availableFrom =
		refusal === 'retake_too_soon'
			? after(facts.lastFailedAt, settings.retakeDays)
			: refusal === 'level_too_recent'
				? after(facts.levelSince, settings.minDaysOnLevel)
				: null;
	return { step: 'exam', kind, refusal, availableFrom };
}
