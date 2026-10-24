import { and, desc, eq, ne, sql } from 'drizzle-orm';
import { alias } from 'drizzle-orm/pg-core';
import type { LimitDb } from '../../auth/rate-limit';
import { certificates, exams } from '../../db/schema/certification';
import { users } from '../../db/schema/users';
import { StorageNotConfigured, type PrivateStorage } from '../../storage/types';
import { isUuid } from '../users/target';
import { certificateState } from './validity';

/* docs/05 section 8: the certificate card and the choices of the issue form. Names only — no
 * contacts or birth dates (docs/04 section 4); routes check `certificates.read` first. */

const issuer = alias(users, 'issuer');

export type CertificateCard = NonNullable<Awaited<ReturnType<typeof getCertificateCard>>>;

export async function getCertificateCard(db: LimitDb, id: string, now = new Date()) {
	if (!isUuid(id)) return null;
	const [row] = await db
		.select({
			id: certificates.id,
			number: certificates.number,
			publicToken: certificates.publicToken,
			userId: certificates.userId,
			memberName: users.name,
			kind: certificates.kind,
			level: certificates.level,
			category: certificates.category,
			issuedAt: certificates.issuedAt,
			expiresAt: certificates.expiresAt,
			status: certificates.status,
			examId: certificates.examId,
			examKind: exams.kind,
			issuedByName: issuer.name,
			fileKey: certificates.fileKey,
			revokedAt: certificates.revokedAt,
			revokeReason: certificates.revokeReason
		})
		.from(certificates)
		.innerJoin(users, eq(users.id, certificates.userId))
		.innerJoin(issuer, eq(issuer.id, certificates.issuedBy))
		.leftJoin(exams, eq(exams.id, certificates.examId))
		.where(eq(certificates.id, id));
	if (!row) return null;
	const { status, ...card } = row;
	return {
		...card,
		level: card.level === 'novice' ? null : card.level,
		state: certificateState({ status, expiresAt: card.expiresAt }, now)
	};
}

const noLiveCertificate = sql`not exists (select 1 from ${certificates}
	where ${certificates.examId} = ${exams.id} and ${certificates.status} <> 'revoked')`;

/** Passed exams of the member without a live certificate: what a certificate can be issued for. */
export async function issuableExams(db: LimitDb, userId: string) {
	if (!isUuid(userId)) return [];
	return db
		.select({ id: exams.id, kind: exams.kind, scheduledAt: exams.scheduledAt })
		.from(exams)
		.where(and(eq(exams.userId, userId), eq(exams.result, 'passed'), noLiveCertificate))
		.orderBy(desc(exams.decidedAt), exams.id);
}

/** The live certificate of an exam (at most one, docs/02 section 2). */
export async function certificateOfExam(
	db: LimitDb,
	examId: string
): Promise<{ id: string; number: string } | null> {
	if (!isUuid(examId)) return null;
	const [row] = await db
		.select({ id: certificates.id, number: certificates.number })
		.from(certificates)
		.where(and(eq(certificates.examId, examId), ne(certificates.status, 'revoked')));
	return row ?? null;
}

/** A 5-minute link to the PDF in the private bucket; none without a file or a bucket. */
export async function certificatePdfLink(
	storage: PrivateStorage,
	fileKey: string | null
): Promise<string | null> {
	if (!fileKey) return null;
	try {
		return await storage.presignGet(fileKey, 'application/pdf');
	} catch (e) {
		if (e instanceof StorageNotConfigured) return null;
		throw e;
	}
}
