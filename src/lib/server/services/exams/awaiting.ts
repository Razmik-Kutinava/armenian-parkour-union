import { and, count, eq, isNull, sql } from 'drizzle-orm';
import type { LimitDb } from '../../auth/rate-limit';
import { exams } from '../../db/schema/certification';
import { users } from '../../db/schema/users';

/* docs/05 section 3 "courses finished and waiting for a certificate": the passed exam of a finished
 * course (`course_access.exam_id`) without a live certificate. Plain SQL with the table names: the
 * subqueries must not bind to their own tables. Decisions — docs/todo.md 9.8 (5). */

export const awaitingCourseCertificate = sql`exams.result = 'passed'
	and exists (select 1 from course_access where course_access.exam_id = exams.id)
	and not exists (select 1 from certificates
		where certificates.exam_id = exams.id and certificates.status <> 'revoked')`;

/** The same rows as the exam list with `certificate=course`. */
export async function awaitingCertificateCount(db: LimitDb) {
	const [{ n }] = await db
		.select({ n: count() })
		.from(exams)
		.innerJoin(users, eq(users.id, exams.userId))
		.where(and(isNull(users.deletedAt), awaitingCourseCertificate));
	return n;
}
