import { describe, expect, it } from 'vitest';
import { resultSchema, scheduleSchema } from './admin-exams';

/* docs/05 section 7: the schedule form and the result form; messages are i18n keys. */

const USER = '7f1c2a8e-3b4d-4c5e-8f60-718293a4b5c6';
const OTHER = '0a1b2c3d-4e5f-4a6b-8c7d-8e9fa0b1c2d3';
const schedule = (extra: Record<string, string> = {}) => ({
	userId: USER,
	kind: 'level_advanced',
	scheduledAt: '2026-11-14T11:00',
	eventId: '',
	examinerId: '',
	notes: '',
	...extra
});
const errorOf = (r: {
	success: boolean;
	error?: { issues: { path: PropertyKey[]; message: string }[] };
}) =>
	r.success ? null : Object.fromEntries(r.error!.issues.map((i) => [String(i.path[0]), i.message]));

describe('admin exams: schedule form', () => {
	it('takes Yerevan time, empty event and examiner as none, no confirmation by default', () => {
		const r = scheduleSchema.safeParse(schedule());
		expect(r.success && r.data).toEqual({
			userId: USER,
			kind: 'level_advanced',
			scheduledAt: new Date('2026-11-14T07:00:00Z'),
			eventId: null,
			examinerId: null,
			notes: null,
			confirmLevel: false
		});
	});

	it('keeps the event, the examiner, trimmed notes and the level confirmation', () => {
		const r = scheduleSchema.safeParse(
			schedule({ eventId: OTHER, examinerId: OTHER, notes: '  Shoes  ', confirmLevel: 'on' })
		);
		expect(r.success && r.data).toMatchObject({
			eventId: OTHER,
			examinerId: OTHER,
			notes: 'Shoes',
			confirmLevel: true
		});
	});

	it('refuses a missing member, an unknown kind, a bad date, bad ids, long notes', () => {
		expect(errorOf(scheduleSchema.safeParse(schedule({ userId: '' })))).toEqual({
			userId: 'exams.error.member'
		});
		expect(errorOf(scheduleSchema.safeParse(schedule({ kind: 'novice' })))).toEqual({
			kind: 'exams.error.kind'
		});
		for (const scheduledAt of ['', '2026-02-30T10:00', '14.11.2026 11:00']) {
			expect(errorOf(scheduleSchema.safeParse(schedule({ scheduledAt })))).toEqual({
				scheduledAt: 'exams.error.date'
			});
		}
		expect(errorOf(scheduleSchema.safeParse(schedule({ eventId: 'x' })))).toEqual({
			eventId: 'exams.error.event'
		});
		expect(errorOf(scheduleSchema.safeParse(schedule({ examinerId: 'x' })))).toEqual({
			examinerId: 'exams.error.examiner'
		});
		expect(errorOf(scheduleSchema.safeParse(schedule({ notes: 'a'.repeat(2001) })))).toEqual({
			notes: 'auth.error.tooLong'
		});
	});
});

describe('admin exams: result form', () => {
	it('passed or failed with a score of up to two decimals; comma works too', () => {
		expect(resultSchema.parse({ result: 'passed', score: '87.5', comment: ' Clean ' })).toEqual({
			result: 'passed',
			score: 87.5,
			comment: 'Clean'
		});
		expect(resultSchema.parse({ result: 'failed', score: '0,25', comment: '' })).toEqual({
			result: 'failed',
			score: 0.25,
			comment: null
		});
		expect(resultSchema.parse({ result: 'cancelled', score: '', comment: '' })).toEqual({
			result: 'cancelled',
			score: null,
			comment: null
		});
	});

	it('refuses an unknown result, a bad score, a score on a cancelled exam, a long comment', () => {
		expect(errorOf(resultSchema.safeParse({ result: 'scheduled', score: '' }))).toEqual({
			result: 'exams.error.result'
		});
		for (const score of ['1000', '-1', '1.234', 'abc']) {
			expect(errorOf(resultSchema.safeParse({ result: 'passed', score }))).toEqual({
				score: 'exams.error.score'
			});
		}
		expect(errorOf(resultSchema.safeParse({ result: 'cancelled', score: '5' }))).toEqual({
			score: 'exams.error.scoreCancelled'
		});
		expect(
			errorOf(resultSchema.safeParse({ result: 'failed', score: '', comment: 'a'.repeat(2001) }))
		).toEqual({ comment: 'auth.error.tooLong' });
	});
});
