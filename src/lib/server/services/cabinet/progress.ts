import { and, desc, eq, isNull, ne, sql } from 'drizzle-orm';
import type { LimitDb } from '../../auth/rate-limit';
import type { MembershipLevel } from '../../auth/session';
import { certificates, exams, staffProfiles } from '../../db/schema/certification';
import { users } from '../../db/schema/users';
import { certificateState, type CertificateState } from '../certificates/validity';
import type { ExamKind } from '../exams/admission';
import type { ExamSettings } from '../exams/settings';
import { isUuid } from '../users/target';
import { nextLevelStep, type NextStep } from './progress-next';

/* docs/06 section 5.5: the signed-in member's own level, exams, certificates and active coach /
 * judge profiles (docs/04 section 5.3). Exam notes, the examiner, the file key and the revoke
 * reason are not selected. */

export type OwnExam = {
	id: string;
	kind: ExamKind;
	scheduledAt: Date | null;
	result: 'scheduled' | 'passed' | 'failed' | 'cancelled';
	score: string | null;
	decidedAt: Date | null;
};

export type OwnCertificate = {
	id: string;
	kind: 'level' | 'trainer' | 'judge';
	level: 'advanced' | 'pro' | null;
	category: string | null;
	number: string;
	publicToken: string;
	issuedAt: Date;
	expiresAt: Date | null;
	state: CertificateState;
	hasPdf: boolean;
};

export type OwnProgress = {
	level: MembershipLevel | null;
	next: NextStep;
	exams: OwnExam[];
	certificates: OwnCertificate[];
	staff: {
		kind: 'trainer' | 'judge';
		category: string | null;
		licenseNumber: string | null;
		isPublic: boolean;
	}[];
};

const time = (d: Date | null) => d?.getTime() ?? 0;

/** Scheduled first, the soonest on top; then decided, the newest on top. */
const examOrder = (a: OwnExam, b: OwnExam) => {
	const aOpen = a.result === 'scheduled';
	if (aOpen !== (b.result === 'scheduled')) return aOpen ? -1 : 1;
	if (aOpen) return time(a.scheduledAt) - time(b.scheduledAt);
	return time(b.decidedAt ?? b.scheduledAt) - time(a.decidedAt ?? a.scheduledAt);
};

async function ownCertificates(db: LimitDb, userId: string, now: Date): Promise<OwnCertificate[]> {
	const rows = await db
		.select({
			id: certificates.id,
			kind: certificates.kind,
			level: certificates.level,
			category: certificates.category,
			number: certificates.number,
			publicToken: certificates.publicToken,
			issuedAt: certificates.issuedAt,
			expiresAt: certificates.expiresAt,
			status: certificates.status,
			hasFile: sql<boolean>`${certificates.fileKey} is not null`
		})
		.from(certificates)
		.where(eq(certificates.userId, userId))
		.orderBy(desc(certificates.issuedAt), desc(certificates.id));
	return rows.map(({ status, hasFile, level, ...c }) => {
		const state = certificateState({ status, expiresAt: c.expiresAt }, now);
		const shown = level === 'advanced' || level === 'pro' ? level : null;
		return { ...c, level: shown, state, hasPdf: hasFile && state !== 'revoked' };
	});
}

export async function getOwnProgress(
	db: LimitDb,
	userId: string,
	settings: ExamSettings,
	now = new Date()
): Promise<OwnProgress | null> {
	if (!isUuid(userId)) return null;
	const [user] = await db
		.select({ status: users.status, level: users.level })
		.from(users)
		.where(and(eq(users.id, userId), isNull(users.deletedAt)));
	if (!user) return null;
	const [next, examRows, certs, staff] = await Promise.all([
		nextLevelStep(db, userId, user, settings, now),
		db
			.select({
				id: exams.id,
				kind: exams.kind,
				scheduledAt: exams.scheduledAt,
				result: exams.result,
				score: exams.score,
				decidedAt: exams.decidedAt
			})
			.from(exams)
			.where(eq(exams.userId, userId)),
		ownCertificates(db, userId, now),
		db
			.select({
				kind: staffProfiles.kind,
				category: staffProfiles.category,
				licenseNumber: staffProfiles.licenseNumber,
				isPublic: staffProfiles.isPublic
			})
			.from(staffProfiles)
			.where(and(eq(staffProfiles.userId, userId), eq(staffProfiles.isActive, true)))
			.orderBy(staffProfiles.kind)
	]);
	return { level: user.level, next, exams: examRows.sort(examOrder), certificates: certs, staff };
}

/** The PDF of an own, not revoked certificate; `null` — another member's, revoked or no file. */
export async function ownCertificatePdfKey(
	db: LimitDb,
	userId: string,
	id: string
): Promise<string | null> {
	if (!isUuid(userId) || !isUuid(id)) return null;
	const [row] = await db
		.select({ fileKey: certificates.fileKey })
		.from(certificates)
		.where(
			and(
				eq(certificates.id, id),
				eq(certificates.userId, userId),
				ne(certificates.status, 'revoked')
			)
		);
	return row?.fileKey ?? null;
}
