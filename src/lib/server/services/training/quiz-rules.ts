/* docs/03 section 18.3 p. 1–2: who may start an attempt now. Decisions — docs/todo.md 9.6 (2).
 * The pause counts from the end of the last failed attempt (an extra one too); the limit counts
 * regular attempts started inside the sliding period. A regular attempt goes first; an extra one
 * only when the pause or the limit stops it. */

export type QuizSettings = {
	retakeDays: number;
	attemptsLimit: number;
	attemptsPeriodDays: number;
	requiresMembership: boolean;
};
export type PastAttempt = {
	startedAt: Date;
	expiresAt: Date;
	submittedAt: Date | null;
	passed: boolean | null;
	isExtra: boolean;
};
export type QuizFacts = {
	settings: QuizSettings;
	attempts: PastAttempt[];
	extraAttempts: number;
	/** `course_access.exam_id` is set. */
	finished: boolean;
	membership: boolean;
};
export type QuizState =
	| { kind: 'finished' | 'passed' | 'running' | 'membership' }
	| { kind: 'wait'; retakeAt: Date }
	| { kind: 'open'; extra: boolean };

const DAY = 86_400_000;

export const isRunning = (a: PastAttempt, now: Date) => a.passed === null && a.expiresAt > now;
/** An unsent attempt past its time ends at `expires_at`. */
const endOf = (a: PastAttempt) => (a.submittedAt ?? a.expiresAt).getTime();

function regularInPeriod(facts: QuizFacts, now: Date) {
	const from = now.getTime() - facts.settings.attemptsPeriodDays * DAY;
	return facts.attempts
		.filter((a) => !a.isExtra && a.startedAt.getTime() > from)
		.map((a) => a.startedAt.getTime())
		.sort((a, b) => a - b);
}

export function attemptsLeft(facts: QuizFacts, now: Date) {
	return Math.max(0, facts.settings.attemptsLimit - regularInPeriod(facts, now).length);
}

/** When a regular attempt becomes possible; `null` — already now. */
export function regularFrom(facts: QuizFacts, now: Date): Date | null {
	const dates: number[] = [];
	const failed = facts.attempts.filter((a) => a.passed !== true && !isRunning(a, now));
	if (failed.length > 0) {
		dates.push(Math.max(...failed.map(endOf)) + facts.settings.retakeDays * DAY);
	}
	const started = regularInPeriod(facts, now);
	const over = started.length - facts.settings.attemptsLimit;
	if (over >= 0) dates.push(started[over] + facts.settings.attemptsPeriodDays * DAY);
	const at = Math.max(...dates, -Infinity);
	return at > now.getTime() ? new Date(at) : null;
}

export function quizState(facts: QuizFacts, now: Date): QuizState {
	if (facts.finished) return { kind: 'finished' };
	if (facts.attempts.some((a) => a.passed === true)) return { kind: 'passed' };
	if (facts.attempts.some((a) => isRunning(a, now))) return { kind: 'running' };
	if (facts.settings.requiresMembership && !facts.membership) return { kind: 'membership' };
	const retakeAt = regularFrom(facts, now);
	if (!retakeAt) return { kind: 'open', extra: false };
	if (facts.extraAttempts > 0) return { kind: 'open', extra: true };
	return { kind: 'wait', retakeAt };
}
