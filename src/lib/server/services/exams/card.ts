import { and, asc, eq, gte, inArray, isNull, lte, sql } from 'drizzle-orm';
import { alias } from 'drizzle-orm/pg-core';
import type { LocalizedText } from '#lib/i18n/localized.ts';
import type { LimitDb } from '../../auth/rate-limit';
import type { MembershipLevel } from '../../auth/session';
import { exams } from '../../db/schema/certification';
import { events } from '../../db/schema/events';
import { users } from '../../db/schema/users';
import { isUuid, type Actor } from '../users/target';

/* docs/05 section 7: the exam card and the choices of the schedule form. Names only — no
 * contacts or birth dates (docs/04 section 4); routes check `exams.manage` first. */

const DAY = 86_400_000;
const examiner = alias(users, 'examiner');

export type ExamCard = NonNullable<Awaited<ReturnType<typeof getExamCard>>>;

export async function getExamCard(db: LimitDb, id: string) {
	if (!isUuid(id)) return null;
	const [row] = await db
		.select({
			id: exams.id,
			userId: exams.userId,
			memberName: users.name,
			memberLevel: users.level,
			kind: exams.kind,
			scheduledAt: exams.scheduledAt,
			eventId: exams.eventId,
			eventTitle: events.title,
			examinerName: examiner.name,
			notes: exams.notes,
			result: exams.result,
			score: exams.score,
			decidedAt: exams.decidedAt
		})
		.from(exams)
		.innerJoin(users, eq(users.id, exams.userId))
		.leftJoin(events, eq(events.id, exams.eventId))
		.leftJoin(examiner, eq(examiner.id, exams.examinerId))
		.where(eq(exams.id, id));
	if (!row) return null;
	return { ...row, eventTitle: row.eventTitle as LocalizedText | null };
}

/** docs/04 section 2: the examiner is an active moderator or admin. */
export async function examinerOptions(db: LimitDb): Promise<{ id: string; name: string }[]> {
	return db
		.select({ id: users.id, name: users.name })
		.from(users)
		.where(
			and(
				inArray(users.role, ['moderator', 'admin']),
				eq(users.status, 'active'),
				isNull(users.deletedAt)
			)
		)
		.orderBy(asc(users.name), asc(users.id));
}

export type ExamEventOption = { id: string; title: LocalizedText; startsAt: Date };

/** Events an exam can belong to: from 90 days back to a year ahead, the closest to now first. */
export async function examEventOptions(db: LimitDb, now: Date): Promise<ExamEventOption[]> {
	const rows = await db
		.select({ id: events.id, title: events.title, startsAt: events.startsAt })
		.from(events)
		.where(
			and(
				isNull(events.deletedAt),
				gte(events.startsAt, new Date(now.getTime() - 90 * DAY)),
				lte(events.startsAt, new Date(now.getTime() + 365 * DAY))
			)
		)
		.orderBy(
			sql`abs(extract(epoch from ${events.startsAt} - ${now.toISOString()}::timestamptz))`,
			asc(events.id)
		)
		.limit(200);
	return rows.map((r) => ({ ...r, title: r.title as LocalizedText }));
}

export type ExamMember = {
	id: string;
	name: string;
	level: MembershipLevel | null;
	status: 'active' | 'blocked';
};

/** The chosen member; a moderator reaches members only, like the user list (docs/04 section 6.5). */
export async function examMember(
	db: LimitDb,
	viewer: Actor,
	id: string
): Promise<ExamMember | null> {
	if (!isUuid(id)) return null;
	const where = [eq(users.id, id), isNull(users.deletedAt)];
	if (viewer.role !== 'admin') where.push(eq(users.role, 'member'));
	const [row] = await db
		.select({ id: users.id, name: users.name, level: users.level, status: users.status })
		.from(users)
		.where(and(...where));
	return row ?? null;
}
