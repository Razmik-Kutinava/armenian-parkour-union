import type { PortalText } from '#lib/i18n/localized.ts';
import type { LimitDb } from '../../auth/rate-limit';
import type { Actor } from '../users/target';
import { openPortal, type PortalGate } from './portal-gate';
import { normalizeAnswers, settleExpired, type Answers, type QuizDeps } from './quiz-close';
import type { SnapshotQuestion } from './quiz-draw';
import {
	accessOf,
	attemptsOf,
	bankSize,
	quizCourse,
	quizFacts,
	type AttemptRow
} from './quiz-facts';
import { attemptsLeft, quizState, type QuizState } from './quiz-rules';

/* docs/06 section 5.11 "Quiz" and the portal block: the rules, the state, the running attempt
 * without correct answers, the history. Decisions — docs/todo.md 9.6 (6, 9, 10). */

export type QuizQuestionView = { text: PortalText; options: PortalText[] };
export type QuizPageState = QuizState | { kind: 'preview' | 'bank' };
export type QuizResultView = {
	id: string;
	startedAt: Date;
	correct: number;
	total: number;
	passed: boolean;
	isExtra: boolean;
};
export type QuizStatus = {
	rules: {
		size: number;
		passCount: number;
		minutes: number;
		attemptsLimit: number;
		attemptsLeft: number;
		extraAttempts: number;
	};
	state: QuizPageState;
	running: {
		id: string;
		questions: QuizQuestionView[];
		answers: Answers;
		secondsLeft: number;
	} | null;
	last: QuizResultView | null;
	history: QuizResultView[];
};

function runningView(row: AttemptRow, now: Date): NonNullable<QuizStatus['running']> {
	const questions = row.questions as SnapshotQuestion[];
	return {
		id: row.id,
		questions: questions.map((q) => ({ text: q.text, options: q.options })),
		answers: normalizeAnswers(questions, row.answers ?? []),
		secondsLeft: Math.max(0, Math.floor((row.expiresAt.getTime() - now.getTime()) / 1000))
	};
}

const resultView = (row: AttemptRow): QuizResultView => ({
	id: row.id,
	startedAt: row.startedAt,
	correct: row.correctCount ?? 0,
	total: row.total,
	passed: row.passed === true,
	isExtra: row.isExtra
});

/** For the quiz page and the portal block; closes attempts past their time first. */
export async function quizStatus(
	db: LimitDb,
	gate: PortalGate,
	userId: string,
	deps: QuizDeps
): Promise<QuizStatus | null> {
	const course = await quizCourse(db, gate.course.id);
	if (!course) return null;
	const rules = {
		size: course.quizSize,
		passCount: course.passCount,
		minutes: course.quizMinutes,
		attemptsLimit: course.attemptsLimit,
		attemptsLeft: course.attemptsLimit,
		extraAttempts: 0
	};
	if (gate.preview)
		return { rules, state: { kind: 'preview' }, running: null, last: null, history: [] };
	const now = deps.now ?? new Date();
	await settleExpired(db, course.id, userId, deps, now);
	const access = await accessOf(db, course.id, userId);
	if (!access) return null;
	const attempts = await attemptsOf(db, course.id, userId);
	const facts = await quizFacts(db, course, access, attempts, userId, now);
	let state: QuizPageState = quizState(facts, now);
	if (state.kind === 'open' && (await bankSize(db, course.id)) < course.quizSize) {
		state = { kind: 'bank' };
	}
	const live = attempts.find((a) => a.passed === null);
	const history = attempts.filter((a) => a.passed !== null).map(resultView);
	return {
		rules: {
			...rules,
			attemptsLeft: attemptsLeft(facts, now),
			extraAttempts: access.extraAttempts
		},
		state,
		running: live ? runningView(live, now) : null,
		last: history[0] ?? null,
		history
	};
}

/** `null` — no such course or no access: the page answers 404. */
export async function quizPage(db: LimitDb, viewer: Actor, slug: string, deps: QuizDeps) {
	const gate = await openPortal(db, viewer, slug);
	if (!gate) return null;
	const status = await quizStatus(db, gate, viewer.id, deps);
	return status ? { ...gate, ...status } : null;
}
