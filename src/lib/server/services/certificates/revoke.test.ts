import { afterAll, describe, expect, it } from 'vitest';
import { users } from '../../db/schema/users';
import { testDb, testDbUrl } from '../../db/test-db';
import { auditFor } from '../memberships/test-support';
import { insertMember } from '../registrations/test-support';
import { eq } from 'drizzle-orm';
import { revokeCertificate } from './revoke';
import { IP, certRow, insertStaff, issuer, levelOf, passedExam } from './test-support';

/* docs/03 section 4.7: only an admin revokes, with a reason. Points are not taken back and the
 * level is not recalculated automatically — the admin decides separately. */

const NOW = new Date();

describe.skipIf(!testDbUrl)('certificates: revoke', () => {
	const { inRollback, close } = testDb();
	afterAll(close);

	async function issued(tx: Parameters<typeof insertMember>[0]) {
		const member = await insertMember(tx, { level: 'novice' });
		const admin = await insertStaff(tx, 'admin');
		const exam = await passedExam(tx, member.id);
		const result = await issuer(tx)(admin, {
			userId: member.id,
			kind: 'level',
			level: 'advanced',
			examId: exam.id
		});
		if (!result.ok) throw new Error(result.reason);
		return { member, admin, exam, id: result.id };
	}

	const balanceOf = async (tx: Parameters<typeof insertMember>[0], id: string) =>
		(await tx.select({ b: users.pointsBalance }).from(users).where(eq(users.id, id)))[0].b;

	it('an admin revokes with a reason; level and points stay; logged', async () => {
		await inRollback(async (tx) => {
			const { member, admin, id } = await issued(tx);
			const balance = await balanceOf(tx, member.id);

			const input = { certificateId: id, reason: '  Exam result annulled  ' };
			expect(await revokeCertificate(tx, admin, input, IP, NOW)).toBe('ok');
			expect(await certRow(tx, id)).toMatchObject({
				status: 'revoked',
				revokedAt: NOW,
				revokeReason: 'Exam result annulled'
			});
			expect(await levelOf(tx, member.id)).toBe('advanced');
			expect(await balanceOf(tx, member.id)).toBe(balance);
			const entries = await auditFor(tx, 'certificate', id);
			expect(entries.map((e) => e.action)).toEqual(['certificate.issue', 'certificate.revoke']);
			expect(entries[1]).toMatchObject({
				actorId: admin.id,
				before: { status: 'active' },
				after: { status: 'revoked', reason: 'Exam result annulled', userId: member.id }
			});
		});
	});

	it('once; moderator, empty or long reason, unknown certificate — refused, nothing changes', async () => {
		await inRollback(async (tx) => {
			const { admin, id } = await issued(tx);
			const run = (actor: typeof admin, extra: { certificateId?: string; reason?: string }) =>
				revokeCertificate(tx, actor, { certificateId: id, reason: 'Mistake', ...extra }, IP, NOW);

			expect(await run(await insertStaff(tx, 'moderator'), {})).toBe('not_allowed');
			expect(await run(admin, { reason: '   ' })).toBe('invalid');
			expect(await run(admin, { reason: 'x'.repeat(2001) })).toBe('invalid');
			expect(await run(admin, { certificateId: crypto.randomUUID() })).toBe('not_found');
			expect(await run(admin, { certificateId: 'nope' })).toBe('not_found');
			expect(await certRow(tx, id)).toMatchObject({ status: 'active', revokedAt: null });

			expect(await run(admin, {})).toBe('ok');
			expect(await run(admin, { reason: 'Again' })).toBe('already_revoked');
			expect(await certRow(tx, id)).toMatchObject({ revokeReason: 'Mistake' });
		});
	});

	it('after a revoke the same exam can get a new certificate', async () => {
		await inRollback(async (tx) => {
			const { member, admin, exam, id } = await issued(tx);
			expect(await revokeCertificate(tx, admin, { certificateId: id, reason: 'Typo' }, IP)).toBe('ok');
			const again = await issuer(tx)(admin, {
				userId: member.id,
				kind: 'level',
				level: 'advanced',
				examId: exam.id
			});
			expect(again.ok).toBe(true);
		});
	});
});
