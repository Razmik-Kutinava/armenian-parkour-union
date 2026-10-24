import { eq } from 'drizzle-orm';
import type { LimitDb } from '../../auth/rate-limit';
import type { UserRole } from '../../auth/session';
import { certificates, exams } from '../../db/schema/certification';
import { users } from '../../db/schema/users';
import { insertUser } from '../../db/test-db';
import type { ExamSettings } from './settings';

/* Test support only: exam tests run inside a rolled-back transaction; settings are passed in. */

export const DAY = 86_400_000;
export const IP = '198.51.100.7';
export const NO_LIMITS: ExamSettings = { retakeDays: 0, minDaysOnLevel: 0 };

export const daysFrom = (now: Date, days: number) => new Date(now.getTime() + days * DAY);

export async function insertStaff(tx: LimitDb, role: UserRole = 'moderator') {
	return { id: (await insertUser(tx, { role })).id, role };
}

export async function insertExam(
	tx: LimitDb,
	values: Pick<typeof exams.$inferInsert, 'userId' | 'kind'> & Partial<typeof exams.$inferInsert>
) {
	const [row] = await tx
		.insert(exams)
		.values({ scheduledAt: new Date(Date.now() - DAY), ...values })
		.returning();
	return row;
}

export async function insertCertificate(
	tx: LimitDb,
	values: Pick<typeof certificates.$inferInsert, 'userId' | 'kind' | 'issuedBy'> &
		Partial<typeof certificates.$inferInsert>
) {
	const tag = crypto.randomUUID();
	const [row] = await tx
		.insert(certificates)
		.values({ number: `T-${tag}`, publicToken: tag, issuedAt: new Date(), ...values })
		.returning();
	return row;
}

export async function examRow(tx: LimitDb, id: string) {
	const [row] = await tx.select().from(exams).where(eq(exams.id, id));
	return row;
}

export async function examsOf(tx: LimitDb, userId: string) {
	return tx.select().from(exams).where(eq(exams.userId, userId));
}

export async function levelOf(tx: LimitDb, userId: string) {
	const [row] = await tx.select({ level: users.level }).from(users).where(eq(users.id, userId));
	return row.level;
}
