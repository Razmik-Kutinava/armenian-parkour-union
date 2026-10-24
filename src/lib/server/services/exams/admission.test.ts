import { describe, expect, it } from 'vitest';
import { checkExamAdmission, type ExamAdmissionInput } from './admission';
import { DAY, NO_LIMITS } from './test-support';

/* docs/03 section 3.3, 4.2; docs/05 section 7: hard conditions refuse, a level that does not fit
 * only warns. */

const AT = new Date('2026-11-10T10:00:00Z');
const ago = (days: number) => new Date(AT.getTime() - days * DAY);

const base = (extra: Partial<ExamAdmissionInput> = {}): ExamAdmissionInput => ({
	at: AT,
	kind: 'level_advanced',
	user: { status: 'active', level: 'novice' },
	membershipActive: true,
	scheduled: false,
	awaitingCertificate: false,
	lastFailedAt: null,
	levelSince: ago(400),
	settings: NO_LIMITS,
	...extra
});

describe('exams: admission', () => {
	it('a novice member with a membership goes to the advanced exam without warnings', () => {
		expect(checkExamAdmission(base())).toEqual({ refusal: null, warnings: [] });
	});

	it('blocked, no membership, one already scheduled, a pass awaiting its certificate — refused', () => {
		const cases: [Partial<ExamAdmissionInput>, string][] = [
			[{ user: { status: 'blocked', level: 'novice' }, membershipActive: false }, 'blocked'],
			[{ membershipActive: false }, 'no_membership'],
			[{ scheduled: true }, 'already_scheduled'],
			[{ awaitingCertificate: true }, 'awaiting_certificate']
		];
		for (const [extra, refusal] of cases) {
			expect(checkExamAdmission(base(extra)).refusal, refusal).toBe(refusal);
		}
	});

	it('a level one step below is required: otherwise a warning, not a refusal', () => {
		const warn = (kind: ExamAdmissionInput['kind'], level: ExamAdmissionInput['user']['level']) =>
			checkExamAdmission(base({ kind, user: { status: 'active', level } }));
		expect(warn('level_pro', 'advanced')).toEqual({ refusal: null, warnings: [] });
		for (const [kind, level] of [
			['level_pro', 'novice'],
			['level_advanced', 'advanced'],
			['level_advanced', 'pro'],
			['level_advanced', null]
		] as const) {
			expect(warn(kind, level), `${kind} at ${level}`).toEqual({
				refusal: null,
				warnings: ['level_mismatch']
			});
		}
	});

	it('trainer and judge exams do not depend on the level', () => {
		for (const kind of ['trainer', 'judge'] as const) {
			expect(checkExamAdmission(base({ kind, user: { status: 'active', level: null } }))).toEqual({
				refusal: null,
				warnings: []
			});
		}
	});

	it('a retake waits `retake_days` after the last failure, counted to the new exam date', () => {
		const settings = { retakeDays: 30, minDaysOnLevel: 0 };
		expect(checkExamAdmission(base({ settings, lastFailedAt: ago(10) })).refusal).toBe(
			'retake_too_soon'
		);
		expect(checkExamAdmission(base({ settings, lastFailedAt: ago(30) })).refusal).toBeNull();
		expect(checkExamAdmission(base({ lastFailedAt: ago(1) })).refusal).toBeNull();
	});

	it('`min_days_on_level` on the current level before a level exam; unknown start — not blocked', () => {
		const settings = { retakeDays: 0, minDaysOnLevel: 90 };
		expect(checkExamAdmission(base({ settings, levelSince: ago(10) })).refusal).toBe(
			'level_too_recent'
		);
		expect(checkExamAdmission(base({ settings, levelSince: ago(90) })).refusal).toBeNull();
		expect(checkExamAdmission(base({ settings, levelSince: null })).refusal).toBeNull();
		expect(
			checkExamAdmission(base({ settings, kind: 'trainer', levelSince: ago(1) })).refusal
		).toBeNull();
	});
});
