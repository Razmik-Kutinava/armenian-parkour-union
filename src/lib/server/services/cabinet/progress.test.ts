import { eq } from 'drizzle-orm';
import { afterAll, describe, expect, it } from 'vitest';
import { staffProfiles } from '../../db/schema/certification';
import { users } from '../../db/schema/users';
import { insertUser, testDb, testDbUrl } from '../../db/test-db';
import { DAY, NO_LIMITS, insertCertificate, insertExam } from '../exams/test-support';
import { insertMember } from '../registrations/test-support';
import { getOwnProgress, ownCertificatePdfKey } from './progress';

/* docs/06 section 5.5: the member's own level, exams, certificates and coach / judge profile;
 * docs/04 section 5.3: nothing of another member, a foreign or revoked PDF is "not found". */

const NOW = new Date();
const ago = (days: number) => new Date(NOW.getTime() - days * DAY);

describe.skipIf(!testDbUrl)('cabinet: progress', () => {
	const { inRollback, close } = testDb();
	afterAll(close);

	it('own exams: scheduled first by date, then decided newest first; no notes or examiner', async () => {
		await inRollback(async (tx) => {
			const member = await insertMember(tx, { level: 'novice' });
			const other = await insertMember(tx);
			const examiner = await insertUser(tx, { role: 'moderator' });
			const failed = await insertExam(tx, {
				userId: member.id,
				kind: 'level_advanced',
				scheduledAt: ago(40),
				result: 'failed',
				score: '41.50',
				decidedAt: ago(40),
				examinerId: examiner.id,
				notes: 'Internal note'
			});
			const passed = await insertExam(tx, {
				userId: member.id,
				kind: 'trainer',
				scheduledAt: ago(10),
				result: 'passed',
				decidedAt: ago(9)
			});
			const later = await insertExam(tx, {
				userId: member.id,
				kind: 'judge',
				scheduledAt: new Date(NOW.getTime() + 20 * DAY)
			});
			const sooner = await insertExam(tx, {
				userId: member.id,
				kind: 'level_advanced',
				scheduledAt: new Date(NOW.getTime() + 5 * DAY)
			});
			await insertExam(tx, { userId: other.id, kind: 'trainer' });

			const progress = await getOwnProgress(tx, member.id, NO_LIMITS, NOW);
			expect(progress?.exams.map((e) => e.id)).toEqual([sooner.id, later.id, passed.id, failed.id]);
			expect(progress?.exams[3]).toEqual({
				id: failed.id,
				kind: 'level_advanced',
				scheduledAt: failed.scheduledAt,
				result: 'failed',
				score: '41.50',
				decidedAt: failed.decidedAt
			});
			expect(JSON.stringify(progress)).not.toContain('Internal note');
		});
	});

	it('own certificates newest first: state, PDF flag, token; no file key or revoke reason', async () => {
		await inRollback(async (tx) => {
			const member = await insertMember(tx, { level: 'advanced' });
			const other = await insertMember(tx);
			const admin = await insertUser(tx, { role: 'admin' });
			const base = { userId: member.id, issuedBy: admin.id };
			const level = await insertCertificate(tx, {
				...base,
				kind: 'level',
				level: 'advanced',
				issuedAt: ago(300),
				fileKey: `certificates/${member.id}/a.pdf`
			});
			const expired = await insertCertificate(tx, {
				...base,
				kind: 'judge',
				category: 'National',
				issuedAt: ago(200),
				expiresAt: ago(1)
			});
			const revoked = await insertCertificate(tx, {
				...base,
				kind: 'trainer',
				issuedAt: ago(100),
				status: 'revoked',
				revokedAt: ago(50),
				revokeReason: 'Secret reason',
				fileKey: `certificates/${member.id}/r.pdf`
			});
			await insertCertificate(tx, { userId: other.id, kind: 'trainer', issuedBy: admin.id });

			const progress = await getOwnProgress(tx, member.id, NO_LIMITS, NOW);
			expect(progress?.certificates.map((c) => c.id)).toEqual([revoked.id, expired.id, level.id]);
			expect(progress?.certificates[2]).toEqual({
				id: level.id,
				kind: 'level',
				level: 'advanced',
				category: null,
				number: level.number,
				publicToken: level.publicToken,
				issuedAt: level.issuedAt,
				expiresAt: null,
				state: 'active',
				hasPdf: true
			});
			expect(progress?.certificates[1]).toMatchObject({ state: 'expired', hasPdf: false });
			expect(progress?.certificates[0]).toMatchObject({ state: 'revoked', hasPdf: false });
			const text = JSON.stringify(progress);
			expect(text).not.toContain('Secret reason');
			expect(text).not.toContain('.pdf');
			expect(text).not.toContain(member.email);
		});
	});

	it('only active own coach and judge profiles, with the public flag', async () => {
		await inRollback(async (tx) => {
			const member = await insertMember(tx);
			const other = await insertMember(tx);
			await tx.insert(staffProfiles).values([
				{
					userId: member.id,
					kind: 'trainer',
					category: 'National',
					licenseNumber: 'LIC-1',
					isPublic: true
				},
				{ userId: member.id, kind: 'judge', isActive: false },
				{ userId: other.id, kind: 'judge' }
			]);
			const progress = await getOwnProgress(tx, member.id, NO_LIMITS, NOW);
			expect(progress?.staff).toEqual([
				{ kind: 'trainer', category: 'National', licenseNumber: 'LIC-1', isPublic: true }
			]);
		});
	});

	it('next step: no level → join; pro → top; novice with membership → advanced exam', async () => {
		await inRollback(async (tx) => {
			const fresh = await insertUser(tx);
			const pro = await insertMember(tx, { level: 'pro' });
			const novice = await insertMember(tx, { level: 'novice' });
			expect((await getOwnProgress(tx, fresh.id, NO_LIMITS, NOW))?.next).toEqual({ step: 'join' });
			expect((await getOwnProgress(tx, fresh.id, NO_LIMITS, NOW))?.level).toBeNull();
			expect((await getOwnProgress(tx, pro.id, NO_LIMITS, NOW))?.next).toEqual({ step: 'top' });
			expect((await getOwnProgress(tx, novice.id, NO_LIMITS, NOW))?.next).toEqual({
				step: 'exam',
				kind: 'level_advanced',
				refusal: null,
				availableFrom: null
			});
		});
	});

	it('next step refusals: no membership, already scheduled, retake too soon with the date', async () => {
		await inRollback(async (tx) => {
			const lapsed = await insertUser(tx, { level: 'novice' });
			const waiting = await insertMember(tx, { level: 'advanced' });
			const retake = await insertMember(tx, { level: 'novice' });
			await insertExam(tx, { userId: waiting.id, kind: 'level_pro', scheduledAt: NOW });
			await insertExam(tx, {
				userId: retake.id,
				kind: 'level_advanced',
				result: 'failed',
				decidedAt: ago(10)
			});
			const settings = { retakeDays: 30, minDaysOnLevel: 0 };
			const next = async (id: string) => (await getOwnProgress(tx, id, settings, NOW))?.next;
			expect(await next(lapsed.id)).toMatchObject({
				kind: 'level_advanced',
				refusal: 'no_membership'
			});
			expect(await next(waiting.id)).toMatchObject({
				kind: 'level_pro',
				refusal: 'already_scheduled'
			});
			expect(await next(retake.id)).toEqual({
				step: 'exam',
				kind: 'level_advanced',
				refusal: 'retake_too_soon',
				availableFrom: new Date(ago(10).getTime() + 30 * DAY)
			});
		});
	});

	it('deleted, unknown or malformed member: null', async () => {
		await inRollback(async (tx) => {
			const gone = await insertMember(tx);
			await tx.update(users).set({ deletedAt: NOW }).where(eq(users.id, gone.id));
			expect(await getOwnProgress(tx, gone.id, NO_LIMITS, NOW)).toBeNull();
			expect(await getOwnProgress(tx, crypto.randomUUID(), NO_LIMITS, NOW)).toBeNull();
			expect(await getOwnProgress(tx, 'nope', NO_LIMITS, NOW)).toBeNull();
		});
	});

	it('PDF key: own, not revoked, with a file; otherwise null', async () => {
		await inRollback(async (tx) => {
			const member = await insertMember(tx);
			const other = await insertMember(tx);
			const admin = await insertUser(tx, { role: 'admin' });
			const own = await insertCertificate(tx, {
				userId: member.id,
				kind: 'trainer',
				issuedBy: admin.id,
				fileKey: `certificates/${member.id}/own.pdf`
			});
			const noFile = await insertCertificate(tx, {
				userId: member.id,
				kind: 'judge',
				issuedBy: admin.id
			});
			const revoked = await insertCertificate(tx, {
				userId: member.id,
				kind: 'level',
				level: 'advanced',
				issuedBy: admin.id,
				status: 'revoked',
				revokedAt: NOW,
				revokeReason: 'Test',
				fileKey: `certificates/${member.id}/revoked.pdf`
			});
			const foreign = await insertCertificate(tx, {
				userId: other.id,
				kind: 'trainer',
				issuedBy: admin.id,
				fileKey: `certificates/${other.id}/foreign.pdf`
			});
			expect(await ownCertificatePdfKey(tx, member.id, own.id)).toBe(
				`certificates/${member.id}/own.pdf`
			);
			expect(await ownCertificatePdfKey(tx, member.id, noFile.id)).toBeNull();
			expect(await ownCertificatePdfKey(tx, member.id, revoked.id)).toBeNull();
			expect(await ownCertificatePdfKey(tx, member.id, foreign.id)).toBeNull();
			expect(await ownCertificatePdfKey(tx, member.id, 'nope')).toBeNull();
		});
	});
});
