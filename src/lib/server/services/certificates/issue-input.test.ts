import { describe, expect, it } from 'vitest';
import type { IssueCertificateInput } from './issue';
import { examFits, levelStep, parseIssueInput } from './issue-input';
import { SETTINGS } from './test-support';

/* docs/03 sections 3.1, 4.3–4.8; docs/05 section 8: what an issue form may hold, which exam fits
 * which certificate, and the level order (no level is skipped). */

const NOW = new Date('2026-10-24T12:00:00Z');
const USER = '00000000-0000-4000-8000-000000000001';
const EXAM = '00000000-0000-4000-8000-000000000002';
const parse = (extra: Partial<IssueCertificateInput>) =>
	parseIssueInput({ userId: USER, kind: 'level', level: 'advanced', examId: EXAM, ...extra }, SETTINGS, NOW);

describe('certificates: issue input', () => {
	it('a level certificate by an exam: issued now, no end date, no category', () => {
		expect(parse({ comment: '  Clean  ' })).toEqual({
			ok: true,
			value: {
				userId: USER,
				kind: 'level',
				level: 'advanced',
				category: null,
				examId: EXAM,
				issuedAt: NOW,
				expiresAt: null,
				comment: 'Clean'
			}
		});
	});

	it('coach and judge: the end date defaults to the settings, a category is kept', () => {
		const issuedAt = new Date('2026-09-01T08:00:00Z');
		expect(
			parse({ kind: 'trainer', level: null, category: '  B  ', examId: null, comment: 'Old', issuedAt })
		).toMatchObject({
			ok: true,
			value: { level: null, category: 'B', examId: null, issuedAt, expiresAt: new Date('2028-09-01T08:00:00Z') }
		});
		const expiresAt = new Date('2027-01-01T00:00:00Z');
		expect(parse({ kind: 'judge', level: null, expiresAt })).toMatchObject({
			ok: true,
			value: { expiresAt }
		});
	});

	it('without an exam the comment is required (docs/03 section 4.8)', () => {
		expect(parse({ examId: null })).toEqual({ ok: false, reason: 'comment_required' });
		expect(parse({ examId: null, comment: '   ' })).toEqual({ ok: false, reason: 'comment_required' });
		expect(parse({ examId: null, comment: 'Transfer of 2019 records' }).ok).toBe(true);
	});

	it('wrong shapes are invalid', () => {
		const cases: Partial<IssueCertificateInput>[] = [
			{ kind: 'novice' as IssueCertificateInput['kind'] },
			{ level: null },
			{ level: 'novice' as IssueCertificateInput['level'] },
			{ category: 'A' },
			{ expiresAt: new Date('2030-01-01T00:00:00Z') },
			{ kind: 'trainer', level: 'advanced' },
			{ kind: 'trainer', level: null, category: 'x'.repeat(101) },
			{ comment: 'x'.repeat(2001) },
			{ issuedAt: new Date('2026-10-24T12:00:01Z') },
			{ issuedAt: new Date(Number.NaN) },
			{ issuedAt: new Date('1999-12-31T00:00:00Z') },
			{ userId: 'nope' },
			{ examId: 'nope' }
		];
		for (const extra of cases) {
			expect(parse(extra), JSON.stringify(extra)).toEqual({ ok: false, reason: 'invalid' });
		}
	});

	it('coach or judge end date must be after the issue date and in the future', () => {
		const trainer = { kind: 'trainer' as const, level: null };
		expect(parse({ ...trainer, expiresAt: NOW })).toEqual({ ok: false, reason: 'expiry_invalid' });
		expect(parse({ ...trainer, issuedAt: new Date('2020-01-01T00:00:00Z') })).toEqual({
			ok: false,
			reason: 'expiry_invalid'
		});
		expect(parse({ ...trainer, expiresAt: new Date(Number.NaN) })).toEqual({
			ok: false,
			reason: 'expiry_invalid'
		});
	});
});

describe('certificates: exam fits the certificate', () => {
	it('level exams open their level, coach and judge exams their kind', () => {
		expect(examFits('level_advanced', 'level', 'advanced')).toBe(true);
		expect(examFits('level_pro', 'level', 'pro')).toBe(true);
		expect(examFits('trainer', 'trainer', null)).toBe(true);
		expect(examFits('judge', 'judge', null)).toBe(true);
		expect(examFits('level_advanced', 'level', 'pro')).toBe(false);
		expect(examFits('level_pro', 'level', 'advanced')).toBe(false);
		expect(examFits('trainer', 'judge', null)).toBe(false);
		expect(examFits('level_advanced', 'trainer', null)).toBe(false);
	});
});

describe('certificates: level order (docs/03 section 3.1)', () => {
	it('one step up from the level below', () => {
		expect(levelStep('novice', 'advanced')).toBe('up');
		expect(levelStep('advanced', 'pro')).toBe('up');
	});

	it('the same level again (an earlier one revoked) leaves the level as is', () => {
		expect(levelStep('advanced', 'advanced')).toBe('same');
		expect(levelStep('pro', 'pro')).toBe('same');
	});

	it('skipping a level or having none is refused; a certificate never lowers the level', () => {
		expect(levelStep('novice', 'pro')).toBe('level_skip');
		expect(levelStep(null, 'advanced')).toBe('level_skip');
		expect(levelStep(null, 'pro')).toBe('level_skip');
		expect(levelStep('pro', 'advanced')).toBe('level_below');
	});
});
