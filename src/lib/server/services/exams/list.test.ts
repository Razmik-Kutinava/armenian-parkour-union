import { afterAll, describe, expect, it } from 'vitest';
import type { ListState } from '#lib/components/admin/list-state.ts';
import { insertUser, testDb, testDbUrl } from '../../db/test-db';
import { insertMember } from '../registrations/test-support';
import { examListOptions, listExams } from './list';
import { daysFrom, insertExam, insertStaff } from './test-support';

/* docs/05 section 7: member, kind, date, examiner, result, score; filters kind, result, period.
 * docs/04 section 4: no member contacts in the rows; search by email only with `users.read_full`. */

const NOW = new Date();
const state = (q: string, filters: Record<string, string> = {}): ListState => ({
	page: 1,
	sort: examListOptions.defaultSort.key,
	dir: examListOptions.defaultSort.dir,
	q,
	filters
});

describe.skipIf(!testDbUrl)('exams: admin list', () => {
	const { inRollback, close } = testDb();
	afterAll(close);

	it('shows member, kind, date, examiner, result and score; no contacts', async () => {
		await inRollback(async (tx) => {
			const member = await insertMember(tx);
			const moderator = await insertStaff(tx);
			const examiner = await insertUser(tx, { role: 'admin', name: 'Examiner Ann' });
			const exam = await insertExam(tx, {
				userId: member.id,
				kind: 'trainer',
				scheduledAt: daysFrom(NOW, -2),
				examinerId: examiner.id,
				result: 'passed',
				score: '87.50',
				decidedAt: daysFrom(NOW, -1)
			});
			const { rows, total } = await listExams(tx, moderator, state(member.tag));
			expect(total).toBe(1);
			expect(rows[0]).toEqual({
				id: exam.id,
				userId: member.id,
				memberName: `Test ${member.tag}`,
				kind: 'trainer',
				scheduledAt: exam.scheduledAt,
				examinerName: 'Examiner Ann',
				result: 'passed',
				score: '87.50'
			});
			expect(Object.keys(rows[0])).not.toContain('memberEmail');
			expect(JSON.stringify(rows)).not.toContain(member.email);
		});
	});

	it('filters by kind, result and the period of the exam date (Yerevan days)', async () => {
		await inRollback(async (tx) => {
			const member = await insertMember(tx);
			const admin = await insertStaff(tx, 'admin');
			await insertExam(tx, {
				userId: member.id,
				kind: 'trainer',
				scheduledAt: new Date('2026-03-10T20:30:00Z'), // 11 March in Yerevan
				result: 'failed',
				decidedAt: new Date('2026-03-11T08:00:00Z')
			});
			await insertExam(tx, {
				userId: member.id,
				kind: 'judge',
				scheduledAt: new Date('2026-04-01T08:00:00Z')
			});
			const kinds = async (filters: Record<string, string>) =>
				(await listExams(tx, admin, state(member.tag, filters))).rows.map((r) => r.kind);

			expect(await kinds({})).toEqual(['judge', 'trainer']);
			expect(await kinds({ kind: 'trainer' })).toEqual(['trainer']);
			expect(await kinds({ result: 'scheduled' })).toEqual(['judge']);
			expect(await kinds({ result: 'failed' })).toEqual(['trainer']);
			expect(await kinds({ from: '2026-03-11', to: '2026-03-11' })).toEqual(['trainer']);
			expect(await kinds({ to: '2026-03-10' })).toEqual([]);
			expect(await kinds({ from: '2026-03-12' })).toEqual(['judge']);
			expect(await kinds({ kind: 'nonsense', result: 'nonsense', from: 'x' })).toEqual([
				'judge',
				'trainer'
			]);
		});
	});

	it('newest first by default, exams without a date last; ascending on request', async () => {
		await inRollback(async (tx) => {
			const member = await insertMember(tx);
			const admin = await insertStaff(tx, 'admin');
			const older = await insertExam(tx, {
				userId: member.id,
				kind: 'trainer',
				scheduledAt: daysFrom(NOW, -10),
				result: 'cancelled'
			});
			const undated = await insertExam(tx, {
				userId: member.id,
				kind: 'judge',
				scheduledAt: null,
				result: 'cancelled'
			});
			const newer = await insertExam(tx, {
				userId: member.id,
				kind: 'level_advanced',
				scheduledAt: daysFrom(NOW, 5)
			});
			const ids = async (dir: 'asc' | 'desc') =>
				(await listExams(tx, admin, { ...state(member.tag), dir })).rows.map((r) => r.id);
			expect(await ids('desc')).toEqual([newer.id, older.id, undated.id]);
			expect(await ids('asc')).toEqual([older.id, newer.id, undated.id]);
		});
	});

	it('searches by email only for an admin; staff without the right get nothing', async () => {
		await inRollback(async (tx) => {
			const member = await insertMember(tx);
			await insertExam(tx, { userId: member.id, kind: 'trainer' });
			const admin = await insertStaff(tx, 'admin');
			const moderator = await insertStaff(tx);
			const editor = await insertStaff(tx, 'editor');

			expect((await listExams(tx, admin, state(member.email))).total).toBe(1);
			expect((await listExams(tx, moderator, state(member.email))).total).toBe(0);
			expect((await listExams(tx, moderator, state(member.tag))).total).toBe(1);
			expect(await listExams(tx, editor, state(member.tag))).toEqual({ rows: [], total: 0 });
		});
	});
});
