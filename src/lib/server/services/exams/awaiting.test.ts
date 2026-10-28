import { afterAll, describe, expect, it } from 'vitest';
import type { ListState } from '#lib/components/admin/list-state.ts';
import type { LimitDb } from '../../auth/rate-limit';
import { courseAccess } from '../../db/schema/training-progress';
import { testDb, testDbUrl } from '../../db/test-db';
import { insertMember } from '../registrations/test-support';
import { insertOpenCourse } from '../training/test-support';
import { examListOptions, listExams } from './list';
import { insertCertificate, insertExam, insertStaff } from './test-support';

/* docs/05 section 3: "courses finished and waiting for a certificate" opens the exam list with
 * `certificate=course` — passed exams of a finished course without a live certificate; decisions —
 * docs/todo.md 9.8 (5). */

const state = (q: string, filters: Record<string, string>): ListState => ({
	page: 1,
	sort: examListOptions.defaultSort.key,
	dir: examListOptions.defaultSort.dir,
	q,
	filters
});

async function courseExam(tx: LimitDb, userId: string) {
	const exam = await insertExam(tx, { userId, kind: 'trainer', result: 'passed' });
	const course = await insertOpenCourse(tx);
	await tx.insert(courseAccess).values({
		courseId: course.id,
		userId,
		status: 'approved',
		reviewedAt: new Date(),
		examId: exam.id
	});
	return exam;
}

describe.skipIf(!testDbUrl)('exams: finished courses waiting for a certificate', () => {
	const { inRollback, close } = testDb();
	afterAll(close);

	it('only course exams without a live certificate; a revoked one waits again', async () => {
		await inRollback(async (tx) => {
			const member = await insertMember(tx);
			const admin = await insertStaff(tx, 'admin');
			const waiting = await courseExam(tx, member.id);
			const certified = await courseExam(tx, member.id);
			await insertCertificate(tx, {
				userId: member.id,
				kind: 'trainer',
				issuedBy: admin.id,
				examId: certified.id
			});
			const revoked = await courseExam(tx, member.id);
			await insertCertificate(tx, {
				userId: member.id,
				kind: 'trainer',
				issuedBy: admin.id,
				examId: revoked.id,
				status: 'revoked',
				revokedAt: new Date(),
				revokeReason: 'Test'
			});
			await insertExam(tx, { userId: member.id, kind: 'trainer', result: 'passed' });

			const { rows, total } = await listExams(
				tx,
				admin,
				state(member.tag, { certificate: 'course' })
			);
			expect(total).toBe(2);
			expect(rows.map((r) => r.id).sort()).toEqual([waiting.id, revoked.id].sort());
			const all = await listExams(tx, admin, state(member.tag, {}));
			expect(all.total).toBe(4);
		});
	});
});
