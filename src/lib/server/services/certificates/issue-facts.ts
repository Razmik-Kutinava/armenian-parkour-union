import { and, eq, isNull, ne, sql } from 'drizzle-orm';
import { alias } from 'drizzle-orm/pg-core';
import type { LimitDb } from '../../auth/rate-limit';
import { certificates, exams } from '../../db/schema/certification';
import { pointsLedger } from '../../db/schema/points';
import { examFits, type IssueValues } from './issue-input';

/* Reads for `issueCertificate` inside its transaction, after the member row is locked. */

export type ExamRefusal = 'exam_not_found' | 'exam_mismatch' | 'exam_not_passed';

/** docs/03 section 4.3: only a passed exam of this member and of the matching kind. */
export async function checkExam(tx: LimitDb, v: IssueValues): Promise<ExamRefusal | null> {
	if (!v.examId) return null;
	const [exam] = await tx
		.select({ userId: exams.userId, kind: exams.kind, result: exams.result })
		.from(exams)
		.where(eq(exams.id, v.examId))
		.for('update');
	if (!exam) return 'exam_not_found';
	if (exam.userId !== v.userId || !examFits(exam.kind, v.kind, v.level)) return 'exam_mismatch';
	return exam.result === 'passed' ? null : 'exam_not_passed';
}

/** The partial unique indexes of 6.1, checked first for a clear answer. */
export async function liveCertificateExists(tx: LimitDb, v: IssueValues) {
	const live = ne(certificates.status, 'revoked');
	const sameExam = v.examId ? and(eq(certificates.examId, v.examId), live) : undefined;
	const sameLevel = v.level
		? and(
				eq(certificates.userId, v.userId),
				eq(certificates.kind, 'level'),
				eq(certificates.level, v.level),
				live
			)
		: undefined;
	for (const where of [sameExam, sameLevel]) {
		if (!where) continue;
		const [row] = await tx.select({ id: certificates.id }).from(certificates).where(where);
		if (row) return true;
	}
	return false;
}

const reversal = alias(pointsLedger, 'reversal');

/**
 * An award for an earlier certificate of the same kind and level that was not reversed: a
 * re-issue does not pay twice (questions.md, 6.3).
 */
export async function certificatePointsStand(tx: LimitDb, v: IssueValues) {
	const [row] = await tx
		.select({ id: pointsLedger.id })
		.from(pointsLedger)
		.innerJoin(certificates, eq(certificates.id, pointsLedger.sourceId))
		.leftJoin(reversal, eq(reversal.reversalOfId, pointsLedger.id))
		.where(
			and(
				eq(pointsLedger.userId, v.userId),
				eq(pointsLedger.reason, 'certificate'),
				eq(pointsLedger.sourceType, 'certificate'),
				eq(certificates.kind, v.kind),
				sql`${certificates.level} is not distinct from ${v.level}`,
				isNull(reversal.id)
			)
		)
		.limit(1);
	return Boolean(row);
}
