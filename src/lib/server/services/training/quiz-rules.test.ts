import { describe, expect, it } from 'vitest';
import { attemptsLeft, quizState, type PastAttempt, type QuizFacts } from './quiz-rules';

/* docs/03 section 18.3 p. 1–2; decisions — docs/todo.md 9.6 (2). */

const DAY = 86_400_000;
const now = new Date('2026-10-28T09:00:00Z');
const ago = (days: number) => new Date(now.getTime() - days * DAY);

function failed(days: number, extra = false): PastAttempt {
	const startedAt = ago(days);
	return {
		startedAt,
		expiresAt: new Date(startedAt.getTime() + 3_600_000),
		submittedAt: new Date(startedAt.getTime() + 1_800_000),
		passed: false,
		isExtra: extra
	};
}

const facts = (extra: Partial<QuizFacts> = {}): QuizFacts => ({
	settings: { retakeDays: 30, attemptsLimit: 3, attemptsPeriodDays: 180, requiresMembership: true },
	attempts: [],
	extraAttempts: 0,
	finished: false,
	membership: true,
	...extra
});

describe('quiz rules: can a member start', () => {
	it('no attempts yet — open, a regular one; three left', () => {
		expect(quizState(facts(), now)).toEqual({ kind: 'open', extra: false });
		expect(attemptsLeft(facts(), now)).toBe(3);
	});

	it('pause after a failed attempt counts from its end', () => {
		const last = failed(10);
		const state = quizState(facts({ attempts: [last] }), now);
		expect(state).toEqual({
			kind: 'wait',
			retakeAt: new Date(last.submittedAt!.getTime() + 30 * DAY)
		});
		expect(quizState(facts({ attempts: [failed(31)] }), now)).toEqual({
			kind: 'open',
			extra: false
		});
	});

	it('limit: three regular attempts in the sliding period — wait until the oldest leaves it', () => {
		const oldest = failed(170);
		const attempts = [oldest, failed(120), failed(60)];
		expect(attemptsLeft(facts({ attempts }), now)).toBe(0);
		expect(quizState(facts({ attempts }), now)).toEqual({
			kind: 'wait',
			retakeAt: new Date(oldest.startedAt.getTime() + 180 * DAY)
		});
		expect(quizState(facts({ attempts: [failed(190), failed(120), failed(60)] }), now)).toEqual({
			kind: 'open',
			extra: false
		});
	});

	it('both pause and limit — the later date', () => {
		const limitLater = [failed(150), failed(100), failed(5)];
		expect(quizState(facts({ attempts: limitLater }), now)).toEqual({
			kind: 'wait',
			retakeAt: new Date(limitLater[0].startedAt.getTime() + 180 * DAY)
		});
		const pauseLater = [failed(175), failed(100), failed(5)];
		expect(quizState(facts({ attempts: pauseLater }), now)).toEqual({
			kind: 'wait',
			retakeAt: new Date(pauseLater[2].submittedAt!.getTime() + 30 * DAY)
		});
	});

	it('an extra attempt is out of the limit', () => {
		const attempts = [failed(150), failed(100, true), failed(60)];
		expect(attemptsLeft(facts({ attempts }), now)).toBe(1);
		expect(quizState(facts({ attempts }), now)).toEqual({ kind: 'open', extra: false });
	});

	it('an extra attempt ignores the pause and the limit; a regular one goes first when allowed', () => {
		expect(quizState(facts({ attempts: [failed(2)], extraAttempts: 1 }), now)).toEqual({
			kind: 'open',
			extra: true
		});
		const full = [failed(170), failed(120), failed(60)];
		expect(quizState(facts({ attempts: full, extraAttempts: 2 }), now)).toEqual({
			kind: 'open',
			extra: true
		});
		expect(quizState(facts({ extraAttempts: 1 }), now)).toEqual({ kind: 'open', extra: false });
	});

	it('the pause after an extra failed attempt applies to the next regular one', () => {
		const last = failed(3, true);
		expect(quizState(facts({ attempts: [last] }), now)).toMatchObject({ kind: 'wait' });
	});

	it('order of refusals: finished, passed, running, membership', () => {
		const passed = { ...failed(10), passed: true };
		const running: PastAttempt = {
			startedAt: ago(0.01),
			expiresAt: new Date(now.getTime() + 600_000),
			submittedAt: null,
			passed: null,
			isExtra: false
		};
		expect(quizState(facts({ finished: true, attempts: [passed] }), now)).toEqual({
			kind: 'finished'
		});
		expect(quizState(facts({ attempts: [passed], extraAttempts: 1 }), now)).toEqual({
			kind: 'passed'
		});
		expect(quizState(facts({ attempts: [running], membership: false }), now)).toEqual({
			kind: 'running'
		});
		expect(quizState(facts({ membership: false, extraAttempts: 1 }), now)).toEqual({
			kind: 'membership'
		});
	});

	it('no membership is fine when the course does not require it', () => {
		const settings = { ...facts().settings, requiresMembership: false };
		expect(quizState(facts({ settings, membership: false }), now)).toEqual({
			kind: 'open',
			extra: false
		});
	});

	it('an unsent attempt past its time counts as failed at its end', () => {
		const startedAt = ago(5);
		const expired: PastAttempt = {
			startedAt,
			expiresAt: new Date(startedAt.getTime() + 3_600_000),
			submittedAt: null,
			passed: null,
			isExtra: false
		};
		expect(quizState(facts({ attempts: [expired] }), now)).toEqual({
			kind: 'wait',
			retakeAt: new Date(expired.expiresAt.getTime() + 30 * DAY)
		});
	});
});
