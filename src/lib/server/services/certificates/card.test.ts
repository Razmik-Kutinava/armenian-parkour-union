import { afterAll, describe, expect, it } from 'vitest';
import { insertUser, testDb, testDbUrl } from '../../db/test-db';
import { StorageNotConfigured, type PrivateStorage } from '../../storage/types';
import { fakeStorage } from '../media/fake-storage';
import { insertExam } from '../exams/test-support';
import { insertMember } from '../registrations/test-support';
import { certificateOfExam, certificatePdfLink, getCertificateCard, issuableExams } from './card';
import { daysFrom, insertCertificate, passedExam } from './test-support';

/* docs/05 section 8: the card (no contacts, docs/04 section 4), the exams a certificate can be
 * issued for, the certificate of an exam, a short-lived link to the private PDF. */

const NOW = new Date();

describe.skipIf(!testDbUrl)('certificates: card and form choices', () => {
	const { inRollback, close } = testDb();
	afterAll(close);

	it('card: number, member, type, dates, state, exam, issuer, token; bad id → null', async () => {
		await inRollback(async (tx) => {
			const member = await insertMember(tx);
			const admin = await insertUser(tx, { role: 'admin', name: 'Issuer Ann' });
			const exam = await passedExam(tx, member.id, 'judge');
			const cert = await insertCertificate(tx, {
				userId: member.id,
				kind: 'judge',
				category: 'National',
				examId: exam.id,
				issuedBy: admin.id,
				issuedAt: daysFrom(NOW, -400),
				expiresAt: daysFrom(NOW, -1),
				fileKey: `certificates/${member.id}/x.pdf`
			});
			const card = await getCertificateCard(tx, cert.id, NOW);
			expect(card).toEqual({
				id: cert.id,
				number: cert.number,
				publicToken: cert.publicToken,
				userId: member.id,
				memberName: `Test ${member.tag}`,
				kind: 'judge',
				level: null,
				category: 'National',
				issuedAt: cert.issuedAt,
				expiresAt: cert.expiresAt,
				state: 'expired',
				examId: exam.id,
				examKind: 'judge',
				issuedByName: 'Issuer Ann',
				fileKey: `certificates/${member.id}/x.pdf`,
				revokedAt: null,
				revokeReason: null
			});
			expect(JSON.stringify(card)).not.toContain(member.email);
			expect(await getCertificateCard(tx, crypto.randomUUID(), NOW)).toBeNull();
			expect(await getCertificateCard(tx, 'not-a-uuid', NOW)).toBeNull();
		});
	});

	it('issuable exams: passed, of this member, without a live certificate', async () => {
		await inRollback(async (tx) => {
			const member = await insertMember(tx);
			const other = await insertMember(tx);
			const admin = await insertUser(tx, { role: 'admin' });
			const open = await insertExam(tx, {
				userId: member.id,
				kind: 'trainer',
				result: 'passed',
				decidedAt: daysFrom(NOW, -1)
			});
			const reissue = await insertExam(tx, {
				userId: member.id,
				kind: 'level_advanced',
				result: 'passed',
				decidedAt: daysFrom(NOW, -5)
			});
			const done = await passedExam(tx, member.id, 'judge');
			await insertExam(tx, { userId: member.id, kind: 'level_pro', result: 'failed' });
			await insertExam(tx, { userId: member.id, kind: 'level_pro' });
			await passedExam(tx, other.id, 'trainer');
			await insertCertificate(tx, {
				userId: member.id,
				kind: 'judge',
				examId: done.id,
				issuedBy: admin.id
			});
			await insertCertificate(tx, {
				userId: member.id,
				kind: 'level',
				level: 'advanced',
				examId: reissue.id,
				issuedBy: admin.id,
				status: 'revoked',
				revokedAt: NOW,
				revokeReason: 'Test'
			});
			expect(await issuableExams(tx, member.id)).toEqual([
				{ id: open.id, kind: 'trainer', scheduledAt: open.scheduledAt },
				{ id: reissue.id, kind: 'level_advanced', scheduledAt: reissue.scheduledAt }
			]);
			expect(await issuableExams(tx, 'nope')).toEqual([]);
		});
	});

	it('certificate of an exam: the live one only', async () => {
		await inRollback(async (tx) => {
			const member = await insertMember(tx);
			const admin = await insertUser(tx, { role: 'admin' });
			const exam = await passedExam(tx, member.id, 'trainer');
			expect(await certificateOfExam(tx, exam.id)).toBeNull();
			const gone = { status: 'revoked' as const, revokedAt: NOW, revokeReason: 'Test' };
			const base = { userId: member.id, kind: 'trainer' as const, issuedBy: admin.id };
			await insertCertificate(tx, { ...base, examId: exam.id, ...gone });
			expect(await certificateOfExam(tx, exam.id)).toBeNull();
			const live = await insertCertificate(tx, { ...base, examId: exam.id });
			expect(await certificateOfExam(tx, exam.id)).toEqual({ id: live.id, number: live.number });
			expect(await certificateOfExam(tx, 'nope')).toBeNull();
		});
	});
});

describe('certificates: PDF link', () => {
	it('a signed link to the PDF; none without a file or a bucket', async () => {
		const storage = fakeStorage();
		const key = 'certificates/u/c.pdf';
		expect(await certificatePdfLink(storage, key)).toBe(
			'https://bucket.test/certificates/u/c.pdf?get&type=application%2Fpdf'
		);
		expect(await certificatePdfLink(storage, null)).toBeNull();
		const unplugged: PrivateStorage = {
			...storage,
			presignGet: async () => {
				throw new StorageNotConfigured('R2_* is not set');
			}
		};
		expect(await certificatePdfLink(unplugged, key)).toBeNull();
	});
});
