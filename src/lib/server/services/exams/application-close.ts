import { and, eq } from 'drizzle-orm';
import type { LimitDb } from '../../auth/rate-limit';
import { examApplications } from '../../db/schema/certification';
import { writeAudit } from '../audit';
import type { ExamKind } from './admission';

/* When staff schedules an exam, a matching pending application becomes approved. */

export async function approvePendingApplication(
	tx: LimitDb,
	input: {
		userId: string;
		kind: ExamKind;
		examId: string;
		actorId: string;
		ip: string | null;
		now: Date;
	}
) {
	const [row] = await tx
		.select({ id: examApplications.id })
		.from(examApplications)
		.where(
			and(
				eq(examApplications.userId, input.userId),
				eq(examApplications.kind, input.kind),
				eq(examApplications.status, 'pending')
			)
		)
		.for('update');
	if (!row) return;
	await tx
		.update(examApplications)
		.set({
			status: 'approved',
			examId: input.examId,
			reviewedBy: input.actorId,
			reviewedAt: input.now,
			reviewNote: null
		})
		.where(eq(examApplications.id, row.id));
	await writeAudit(tx, {
		actorId: input.actorId,
		action: 'exam_application.approve',
		entityType: 'exam_application',
		entityId: row.id,
		before: { status: 'pending' },
		after: { status: 'approved', examId: input.examId, kind: input.kind },
		ip: input.ip
	});
}
