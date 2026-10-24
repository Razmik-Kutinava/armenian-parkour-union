import { afterAll, describe, expect, it } from 'vitest';
import { testDb, testDbUrl } from '../../db/test-db';
import { insertMember } from '../registrations/test-support';
import { reverseEntry } from '../points/reverse';
import { balanceOf, ledgerOf, setRules } from '../points/test-support';
import type { Actor } from '../users/target';
import { revokeCertificate } from './revoke';
import { IP, insertStaff, issuer, passedExam } from './test-support';

/* docs/03 sections 4.3, 4.7, 6.1–6.2: the issue awards the rule points in the same transaction,
 * sourced by the certificate. A revoke takes nothing back; a re-issue of the same kind and level
 * does not award twice while the earlier award stands (questions.md, 6.3). */

type Tx = Parameters<typeof insertMember>[0];
const RULES = {
	certificate_level_advanced: { points: 100 },
	certificate_level_pro: { points: 200 },
	certificate_trainer: { points: 150 },
	certificate_judge: { points: 150 }
};

describe.skipIf(!testDbUrl)('certificates: points', () => {
	const { inRollback, close } = testDb();
	afterAll(close);

	const advanced = async (tx: Tx, admin: Actor, userId: string) =>
		issuer(tx)(admin, {
			userId,
			kind: 'level',
			level: 'advanced',
			examId: (await passedExam(tx, userId)).id
		});

	it('each kind awards its rule, sourced by the certificate', async () => {
		await inRollback(async (tx) => {
			await setRules(tx, RULES);
			const member = await insertMember(tx, { level: 'novice' });
			const admin = await insertStaff(tx, 'admin');

			const level = await advanced(tx, admin, member.id);
			if (!level.ok) throw new Error(level.reason);
			expect(level.points).toBe(100);
			const trainer = await issuer(tx)(admin, {
				userId: member.id,
				kind: 'trainer',
				examId: (await passedExam(tx, member.id, 'trainer')).id
			});
			if (!trainer.ok) throw new Error(trainer.reason);
			expect(trainer.points).toBe(150);

			const entries = await ledgerOf(tx, member.id);
			expect(entries).toMatchObject([
				{ delta: 100, reason: 'certificate', sourceType: 'certificate', sourceId: level.id },
				{ delta: 150, reason: 'certificate', sourceType: 'certificate', sourceId: trainer.id }
			]);
			expect(await balanceOf(tx, member.id)).toBe(250);
		});
	});

	it('an inactive rule: the certificate and the level, no points', async () => {
		await inRollback(async (tx) => {
			await setRules(tx, { certificate_level_advanced: { points: 100, isActive: false } });
			const member = await insertMember(tx, { level: 'novice' });
			const admin = await insertStaff(tx, 'admin');
			const result = await advanced(tx, admin, member.id);
			expect(result).toMatchObject({ ok: true, points: null, levelChanged: true });
			expect(await ledgerOf(tx, member.id)).toEqual([]);
		});
	});

	it('revoke and re-issue: no second award while the first stands; after its reversal — awarded', async () => {
		await inRollback(async (tx) => {
			await setRules(tx, RULES);
			const member = await insertMember(tx, { level: 'novice' });
			const admin = await insertStaff(tx, 'admin');
			const reissue = async () => {
				const [live] = (await ledgerOf(tx, member.id)).filter((e) => e.reason === 'certificate');
				const certificateId = live.sourceId!;
				const revoked = await revokeCertificate(tx, admin, { certificateId, reason: 'Typo' }, IP);
				expect(revoked).toBe('ok');
				return advanced(tx, admin, member.id);
			};

			const first = await advanced(tx, admin, member.id);
			expect(first).toMatchObject({ ok: true, points: 100 });
			const second = await reissue();
			expect(second).toMatchObject({ ok: true, points: null });
			expect(await balanceOf(tx, member.id)).toBe(100);

			const [award] = await ledgerOf(tx, member.id);
			const reversed = await reverseEntry(
				tx,
				admin,
				{ entryId: award.id, comment: 'Certificate revoked' },
				{ ip: IP }
			);
			expect(reversed.ok).toBe(true);
			expect(await balanceOf(tx, member.id)).toBe(0);
			if (!second.ok) throw new Error(second.reason);
			expect(
				await revokeCertificate(tx, admin, { certificateId: second.id, reason: 'Again' }, IP)
			).toBe('ok');
			expect(await advanced(tx, admin, member.id)).toMatchObject({ ok: true, points: 100 });
			expect(await balanceOf(tx, member.id)).toBe(100);
		});
	});
});
