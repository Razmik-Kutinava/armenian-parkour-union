import { afterAll, describe, expect, it } from 'vitest';
import { testDb, testDbUrl } from '../../db/test-db';
import { recordExamResult } from '../exams/result';
import { scheduleExam } from '../exams/schedule';
import { NO_LIMITS } from '../exams/test-support';
import { insertMember } from '../registrations/test-support';
import { revokeCertificate } from './revoke';
import { IP, certsOf, daysFrom, insertStaff, issuer, levelOf, passedExam } from './test-support';

/* docs/03 section 3.1–3.2: novice → advanced → pro, no level skipped. Scheduling only warns
 * (docs/05 section 7, 6.2) — the issue is where a skip is stopped, with an exam or without. */

type Tx = Parameters<typeof insertMember>[0];
const level = (to: 'advanced' | 'pro') => ({ kind: 'level' as const, level: to });

describe.skipIf(!testDbUrl)('certificates: no level skipped', () => {
	const { inRollback, close } = testDb();
	afterAll(close);

	it('a novice scheduled for "pro" past the warning passes — the certificate is refused', async () => {
		await inRollback(async (tx) => {
			const member = await insertMember(tx, { level: 'novice' });
			const moderator = await insertStaff(tx);
			const admin = await insertStaff(tx, 'admin');
			const now = new Date();
			const scheduled = await scheduleExam(
				tx,
				moderator,
				{
					userId: member.id,
					kind: 'level_pro',
					scheduledAt: daysFrom(now, -1),
					confirmLevel: true
				},
				{ settings: NO_LIMITS },
				IP,
				daysFrom(now, -2)
			);
			if (!scheduled.ok) throw new Error(scheduled.reason);
			expect(scheduled.warnings).toEqual(['level_mismatch']);
			const passed = await recordExamResult(
				tx,
				moderator,
				{ examId: scheduled.id, result: 'passed', score: 95 },
				IP,
				now
			);
			expect(passed).toBe('ok');

			expect(await issuer(tx)(admin, { userId: member.id, ...level('pro'), examId: scheduled.id })).toEqual(
				{ ok: false, reason: 'level_skip' }
			);
			expect(await levelOf(tx, member.id)).toBe('novice');
			expect(await certsOf(tx, member.id)).toEqual([]);
		});
	});

	it('without an exam (old records) a skip is refused too; no level at all — refused', async () => {
		await inRollback(async (tx) => {
			const novice = await insertMember(tx, { level: 'novice' });
			const nobody = await insertMember(tx, { level: null });
			const admin = await insertStaff(tx, 'admin');
			const issue = issuer(tx);
			const comment = 'Transfer of 2019 records';

			expect(await issue(admin, { userId: novice.id, ...level('pro'), comment })).toEqual({
				ok: false,
				reason: 'level_skip'
			});
			expect(await issue(admin, { userId: nobody.id, ...level('advanced'), comment })).toEqual({
				ok: false,
				reason: 'level_skip'
			});
			expect(await levelOf(tx, novice.id)).toBe('novice');
			expect(await levelOf(tx, nobody.id)).toBeNull();
		});
	});

	it('a certificate never lowers the level', async () => {
		await inRollback(async (tx) => {
			const pro = await insertMember(tx, { level: 'pro' });
			const admin = await insertStaff(tx, 'admin');
			const exam = await passedExam(tx, pro.id);
			expect(await issuer(tx)(admin, { userId: pro.id, ...level('advanced'), examId: exam.id })).toEqual(
				{ ok: false, reason: 'level_below' }
			);
			expect(await levelOf(tx, pro.id)).toBe('pro');
		});
	});

	it('step by step: novice → advanced → pro by two passed exams', async () => {
		await inRollback(async (tx) => {
			const member = await insertMember(tx, { level: 'novice' });
			const admin = await insertStaff(tx, 'admin');
			const issue = issuer(tx);
			const advanced = await passedExam(tx, member.id, 'level_advanced');
			const pro = await passedExam(tx, member.id, 'level_pro');

			expect(await issue(admin, { userId: member.id, ...level('pro'), examId: pro.id })).toEqual({
				ok: false,
				reason: 'level_skip'
			});
			expect((await issue(admin, { userId: member.id, ...level('advanced'), examId: advanced.id })).ok).toBe(true);
			expect(await levelOf(tx, member.id)).toBe('advanced');
			expect((await issue(admin, { userId: member.id, ...level('pro'), examId: pro.id })).ok).toBe(true);
			expect(await levelOf(tx, member.id)).toBe('pro');
		});
	});

	it('the same level again after a revoke (level kept by hand): issued, the level stays', async () => {
		await inRollback(async (tx: Tx) => {
			const member = await insertMember(tx, { level: 'novice' });
			const admin = await insertStaff(tx, 'admin');
			const issue = issuer(tx);
			const comment = 'Name corrected';
			const first = await issue(admin, { userId: member.id, ...level('advanced'), comment });
			if (!first.ok) throw new Error(first.reason);
			const revoke = { certificateId: first.id, reason: 'Typo in the name' };
			expect(await revokeCertificate(tx, admin, revoke, IP)).toBe('ok');
			expect(await levelOf(tx, member.id)).toBe('advanced');

			const again = await issue(admin, { userId: member.id, ...level('advanced'), comment });
			if (!again.ok) throw new Error(again.reason);
			expect(again.levelChanged).toBe(false);
			expect(again.number).not.toBe(first.number);
			expect(await levelOf(tx, member.id)).toBe('advanced');
		});
	});
});
