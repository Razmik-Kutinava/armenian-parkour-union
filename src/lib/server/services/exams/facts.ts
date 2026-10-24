import { and, eq, inArray, isNull, max, min, ne } from 'drizzle-orm';
import type { LimitDb } from '../../auth/rate-limit';
import { certificates, exams } from '../../db/schema/certification';
import { events } from '../../db/schema/events';
import { memberships } from '../../db/schema/payments';
import { users } from '../../db/schema/users';
import { getMembershipOverview } from '../memberships/overview';
import { isUuid } from '../users/target';
import { LEVEL_BEFORE, type ExamAdmissionInput, type ExamKind } from './admission';
import type { ExamSettings } from './settings';

/* Reads for `scheduleExam` and `checkExamAdmission` inside the scheduling transaction. */

export async function eventExists(tx: LimitDb, id: string) {
	if (!isUuid(id)) return false;
	const [row] = await tx
		.select({ id: events.id })
		.from(events)
		.where(and(eq(events.id, id), isNull(events.deletedAt)));
	return Boolean(row);
}

/** docs/04 section 2: the examiner is a moderator or an admin. */
export async function examinerValid(tx: LimitDb, id: string) {
	if (!isUuid(id)) return false;
	const [row] = await tx
		.select({ id: users.id })
		.from(users)
		.where(
			and(
				eq(users.id, id),
				inArray(users.role, ['moderator', 'admin']),
				eq(users.status, 'active'),
				isNull(users.deletedAt)
			)
		);
	return Boolean(row);
}

/** The member row locked first: two schedules for one member wait for each other. */
export async function lockExamMember(tx: LimitDb, userId: string) {
	if (!isUuid(userId)) return null;
	const [row] = await tx
		.select({ role: users.role, status: users.status, level: users.level })
		.from(users)
		.where(and(eq(users.id, userId), isNull(users.deletedAt)))
		.for('update');
	return row ?? null;
}

async function kindHistory(tx: LimitDb, userId: string, kind: ExamKind) {
	const rows = await tx
		.select({ result: exams.result, decidedAt: exams.decidedAt, certificateId: certificates.id })
		.from(exams)
		.leftJoin(
			certificates,
			and(eq(certificates.examId, exams.id), ne(certificates.status, 'revoked'))
		)
		.where(and(eq(exams.userId, userId), eq(exams.kind, kind)));
	const failed = rows
		.filter((r) => r.result === 'failed' && r.decidedAt)
		.map((r) => r.decidedAt!.getTime());
	return {
		scheduled: rows.some((r) => r.result === 'scheduled'),
		awaitingCertificate: rows.some((r) => r.result === 'passed' && !r.certificateId),
		lastFailedAt: failed.length ? new Date(Math.max(...failed)) : null
	};
}

/** docs/03 section 2.2: `novice` comes with the first paid membership, higher levels — with a certificate. */
async function levelSince(tx: LimitDb, userId: string, level: string): Promise<Date | null> {
	if (level === 'novice') {
		const [row] = await tx
			.select({ at: min(memberships.startsAt) })
			.from(memberships)
			.where(
				and(eq(memberships.userId, userId), inArray(memberships.status, ['active', 'expired']))
			);
		return row?.at ?? null;
	}
	const [row] = await tx
		.select({ at: max(certificates.issuedAt) })
		.from(certificates)
		.where(
			and(
				eq(certificates.userId, userId),
				eq(certificates.kind, 'level'),
				eq(certificates.level, level as 'advanced' | 'pro'),
				ne(certificates.status, 'revoked')
			)
		);
	return row?.at ?? null;
}

export async function readExamFacts(
	tx: LimitDb,
	userId: string,
	kind: ExamKind,
	level: ExamAdmissionInput['user']['level'],
	settings: ExamSettings,
	now: Date
) {
	const needsSince = settings.minDaysOnLevel > 0 && level !== null && LEVEL_BEFORE[kind] === level;
	const [membership, history, since] = await Promise.all([
		getMembershipOverview(tx, userId, now),
		kindHistory(tx, userId, kind),
		needsSince ? levelSince(tx, userId, level) : null
	]);
	return { membershipActive: membership.active, ...history, levelSince: since };
}
