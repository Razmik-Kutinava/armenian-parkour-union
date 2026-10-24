import { afterAll, describe, expect, it } from 'vitest';
import type { exams } from '../../db/schema/certification';
import { testDb, testDbUrl } from '../../db/test-db';
import { auditFor } from '../memberships/test-support';
import { insertMember } from '../registrations/test-support';
import { recordExamResult, type ExamResultInput } from './result';
import { scheduleExam } from './schedule';
import {
	IP,
	NO_LIMITS,
	daysFrom,
	examRow,
	examsOf,
	insertExam,
	insertStaff,
	levelOf
} from './test-support';

/* docs/03 section 4.2; docs/05 section 7: a moderator or an admin records passed / failed / cancelled
 * once; the result never changes the level (only a certificate does, docs/03 section 3.2). */

const NOW = new Date();
type Tx = Parameters<typeof insertMember>[0];
const pastExam = async (tx: Tx, extra: Partial<typeof exams.$inferInsert> = {}) => {
	const member = await insertMember(tx, { level: 'novice' });
	const exam = await insertExam(tx, {
		userId: member.id,
		kind: 'level_advanced',
		scheduledAt: daysFrom(NOW, -1),
		notes: 'Bring shoes',
		...extra
	});
	return { member, exam };
};

describe.skipIf(!testDbUrl)('exams: result', () => {
	const { inRollback, close } = testDb();
	afterAll(close);

	it('passed with a score: the recorder becomes the examiner, the comment is added; logged', async () => {
		await inRollback(async (tx) => {
			const { member, exam } = await pastExam(tx);
			const moderator = await insertStaff(tx);
			const data: ExamResultInput = {
				examId: exam.id,
				result: 'passed',
				score: 87.5,
				comment: '  Clean run  '
			};

			expect(await recordExamResult(tx, moderator, data, IP, NOW)).toBe('ok');
			expect(await examRow(tx, exam.id)).toMatchObject({
				result: 'passed',
				score: '87.50',
				examinerId: moderator.id,
				notes: 'Bring shoes\n\nClean run',
				decidedAt: NOW
			});
			const [entry] = await auditFor(tx, 'exam', exam.id);
			expect(entry).toMatchObject({
				action: 'exam.result',
				actorId: moderator.id,
				before: { result: 'scheduled' },
				after: { result: 'passed', score: '87.50', userId: member.id, kind: 'level_advanced' }
			});
			expect(await levelOf(tx, member.id)).toBe('novice');
		});
	});

	it('an examiner already set stays; a failed exam is retaken as a new row', async () => {
		await inRollback(async (tx) => {
			const examiner = await insertStaff(tx, 'admin');
			const { member, exam } = await pastExam(tx, { examinerId: examiner.id, notes: null });
			const moderator = await insertStaff(tx);

			const data = { examId: exam.id, result: 'failed' as const };
			expect(await recordExamResult(tx, moderator, data, IP, NOW)).toBe('ok');
			expect(await examRow(tx, exam.id)).toMatchObject({
				result: 'failed',
				score: null,
				examinerId: examiner.id,
				notes: null
			});
			const retake = await scheduleExam(
				tx,
				moderator,
				{ userId: member.id, kind: 'level_advanced', scheduledAt: daysFrom(NOW, 14) },
				{ settings: NO_LIMITS },
				IP,
				NOW
			);
			expect(retake.ok).toBe(true);
			expect(await examsOf(tx, member.id)).toHaveLength(2);
		});
	});

	it('a future exam can be cancelled, not passed; cancelled has no score', async () => {
		await inRollback(async (tx) => {
			const { exam } = await pastExam(tx, { scheduledAt: daysFrom(NOW, 3) });
			const admin = await insertStaff(tx, 'admin');
			const run = (data: Omit<ExamResultInput, 'examId'>) =>
				recordExamResult(tx, admin, { examId: exam.id, ...data }, IP, NOW);

			expect(await run({ result: 'passed' })).toBe('too_early');
			expect(await run({ result: 'failed' })).toBe('too_early');
			expect(await run({ result: 'cancelled', score: 10 })).toBe('invalid');
			expect(await run({ result: 'cancelled' })).toBe('ok');
			expect(await examRow(tx, exam.id)).toMatchObject({
				result: 'cancelled',
				examinerId: null,
				decidedAt: NOW
			});
		});
	});

	it('decided once; editor, unknown exam, bad score or result — refused, nothing changes', async () => {
		await inRollback(async (tx) => {
			const { exam } = await pastExam(tx);
			const moderator = await insertStaff(tx);
			const run = (actor: typeof moderator, data: Partial<ExamResultInput>) =>
				recordExamResult(tx, actor, { examId: exam.id, result: 'passed', ...data }, IP, NOW);

			expect(await run(await insertStaff(tx, 'editor'), {})).toBe('not_allowed');
			expect(await run(moderator, { examId: crypto.randomUUID() })).toBe('not_found');
			expect(await run(moderator, { examId: 'nope' })).toBe('not_found');
			for (const score of [-1, 1000, 1.234, Number.NaN]) {
				expect(await run(moderator, { score }), String(score)).toBe('invalid');
			}
			const scheduled = 'scheduled' as ExamResultInput['result'];
			expect(await run(moderator, { result: scheduled })).toBe('invalid');
			expect(await run(moderator, { comment: 'x'.repeat(2001) })).toBe('invalid');
			expect(await examRow(tx, exam.id)).toMatchObject({ result: 'scheduled', decidedAt: null });
			expect(await auditFor(tx, 'exam', exam.id)).toEqual([]);

			expect(await run(moderator, { score: 999.99 })).toBe('ok');
			expect(await run(moderator, { result: 'failed' })).toBe('already_decided');
			expect(await examRow(tx, exam.id)).toMatchObject({ result: 'passed', score: '999.99' });
		});
	});
});
