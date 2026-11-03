import { and, eq } from 'drizzle-orm';
import type { LimitDb } from '../../auth/rate-limit';
import { examApplications } from '../../db/schema/certification';
import type { ExamKind } from './admission';

/** Own application for a kind — for the progress next-step block. */
export async function ownApplicationFor(
	db: LimitDb,
	userId: string,
	kind: ExamKind
): Promise<{ status: 'pending' | 'rejected'; reviewNote: string | null } | null> {
	const [row] = await db
		.select({
			status: examApplications.status,
			reviewNote: examApplications.reviewNote
		})
		.from(examApplications)
		.where(and(eq(examApplications.userId, userId), eq(examApplications.kind, kind)));
	if (!row || (row.status !== 'pending' && row.status !== 'rejected')) return null;
	return { status: row.status, reviewNote: row.reviewNote };
}
