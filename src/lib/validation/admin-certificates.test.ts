import { describe, expect, it } from 'vitest';
import { issueSchema, revokeSchema } from './admin-certificates';

/* docs/05 section 8: the issue form and the revoke reason; days are Yerevan days; messages are
 * i18n keys. The service checks the rest (level order, exam, expiry against the issue date). */

const NOW = new Date('2026-10-24T12:00:00Z');
const USER = '7f1c2a8e-3b4d-4c5e-8f60-718293a4b5c6';
const EXAM = '0a1b2c3d-4e5f-4a6b-8c7d-8e9fa0b1c2d3';
const issue = (extra: Record<string, string> = {}) => ({
	userId: USER,
	kind: 'level',
	level: 'advanced',
	category: '',
	examId: EXAM,
	issuedAt: '',
	expiresAt: '',
	comment: '',
	...extra
});
const parse = (form: Record<string, string>) => issueSchema(NOW).safeParse(form);
const errorOf = (r: ReturnType<typeof parse>) =>
	r.success ? null : Object.fromEntries(r.error.issues.map((i) => [String(i.path[0]), i.message]));

describe('admin certificates: issue form', () => {
	it('a level with an exam; empty dates are the defaults of the service', () => {
		const r = parse(issue());
		expect(r.success && r.data).toEqual({
			userId: USER,
			kind: 'level',
			level: 'advanced',
			category: null,
			examId: EXAM,
			issuedAt: null,
			expiresAt: null,
			comment: null
		});
	});

	it('coach: a category, a past issue day and an expiry day at Yerevan midnight', () => {
		const r = parse(
			issue({
				kind: 'trainer',
				level: 'pro',
				category: '  Category B ',
				examId: '',
				issuedAt: '2026-10-01',
				expiresAt: '2028-10-24',
				comment: ' Moved from paper '
			})
		);
		expect(r.success && r.data).toEqual({
			userId: USER,
			kind: 'trainer',
			level: null,
			category: 'Category B',
			examId: null,
			issuedAt: new Date('2026-09-30T20:00:00Z'),
			expiresAt: new Date('2028-10-23T20:00:00Z'),
			comment: 'Moved from paper'
		});
	});

	it('today is now; a level drops the category and the expiry of the other types', () => {
		const r = parse(issue({ issuedAt: '2026-10-24', category: 'X', expiresAt: '2030-01-01' }));
		expect(r.success && r.data).toMatchObject({ issuedAt: null, category: null, expiresAt: null });
	});

	it('refuses a missing member, an unknown type, a level without its step, bad days and ids', () => {
		expect(errorOf(parse(issue({ userId: '' })))).toEqual({ userId: 'certificates.error.member' });
		expect(errorOf(parse(issue({ kind: 'novice' })))).toEqual({ kind: 'certificates.error.kind' });
		for (const level of ['', 'novice']) {
			expect(errorOf(parse(issue({ level })))).toEqual({ level: 'certificates.error.level' });
		}
		for (const issuedAt of ['2026-10-25', '2026-02-30', '24.10.2026']) {
			expect(errorOf(parse(issue({ issuedAt })))).toEqual({
				issuedAt: 'certificates.error.issuedAt'
			});
		}
		expect(errorOf(parse(issue({ kind: 'judge', expiresAt: '2028-13-01' })))).toEqual({
			expiresAt: 'certificates.error.expiresAt'
		});
		expect(errorOf(parse(issue({ examId: 'x' })))).toEqual({ examId: 'certificates.error.exam' });
		expect(errorOf(parse(issue({ kind: 'judge', category: 'a'.repeat(101) })))).toEqual({
			category: 'auth.error.tooLong'
		});
		expect(errorOf(parse(issue({ comment: 'a'.repeat(2001) })))).toEqual({
			comment: 'auth.error.tooLong'
		});
	});
});

describe('admin certificates: revoke', () => {
	it('the reason is the dialog comment: required, trimmed, up to 1000', () => {
		expect(revokeSchema.parse({ comment: '  Forged documents ' })).toEqual({
			comment: 'Forged documents'
		});
		for (const comment of ['', '   ']) {
			const r = revokeSchema.safeParse({ comment });
			expect(r.success ? null : r.error.issues[0].message).toBe('auth.error.required');
		}
		const long = revokeSchema.safeParse({ comment: 'a'.repeat(1001) });
		expect(long.success ? null : long.error.issues[0].message).toBe('auth.error.tooLong');
	});
});
