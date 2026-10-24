import { inArray } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { LimitDb } from '../../auth/rate-limit';
import { pointsRules } from '../../db/schema/points';
import { testDbUrl } from '../../db/test-db';
import { auditFor } from '../memberships/test-support';
import { balanceOf, ledgerOf, ledgerSum } from '../points/test-support';
import { raceDb } from '../registrations/race-support';
import type { IssueCertificateInput } from './issue';
import { revokeCertificate } from './revoke';
import { IP, certsOf, issuer, levelOf, passedExam } from './test-support';

/* docs/03 sections 4.3, 4.7, 6.2 p. 2, roadmap 6.10: two admins press "Issue" or "Revoke" at the
 * same moment. The issue locks the member row, the revoke the certificate row, so the second one
 * sees the first: one certificate, one level change, one award, one log entry. These tests commit
 * (registrations/race-support.ts): rules are only added where missing, the expected award follows
 * the rule as it is. */

const RULE = 'certificate_level_advanced';

describe.skipIf(!testDbUrl)('certificates: simultaneous issue and revoke', () => {
	const db = raceDb();
	afterAll(db.cleanup);
	let paysOnce = 0;
	beforeAll(async () => {
		await db.main
			.insert(pointsRules)
			.values({ code: RULE, title: { en: RULE }, points: 100 })
			.onConflictDoNothing({ target: pointsRules.code });
		const [rule] = await db.main
			.select()
			.from(pointsRules)
			.where(inArray(pointsRules.code, [RULE]));
		paysOnce = rule.isActive && rule.points > 0 ? 1 : 0;
	});

	const admins = async () => [await db.staff('admin'), await db.staff('admin')];
	const logged = async (type: string, id: string, action: string) =>
		(await auditFor(db.main, type, id)).filter((e) => e.action === action).length;

	async function issuedOnce(userId: string) {
		const certs = await certsOf(db.main, userId);
		expect(certs).toHaveLength(1);
		expect(await levelOf(db.main, userId)).toBe('advanced');
		expect(await logged('certificate', certs[0].id, 'certificate.issue')).toBe(1);
		expect(await logged('user', userId, 'user.level')).toBe(1);
		expect(await ledgerOf(db.main, userId)).toHaveLength(paysOnce);
		expect(await balanceOf(db.main, userId)).toBe(await ledgerSum(db.main, userId));
	}

	async function both(input: IssueCertificateInput) {
		const [a, b] = await admins();
		return db.race(
			(tx: LimitDb) => issuer(tx)(a, input),
			(tx: LimitDb) => issuer(tx)(b, input)
		);
	}

	it('one passed exam issued twice at once: one certificate, level, award and log entry', async () => {
		const member = await db.member({ level: 'novice' });
		const exam = await passedExam(db.main, member.id);
		const results = await both({
			userId: member.id,
			kind: 'level',
			level: 'advanced',
			examId: exam.id
		});
		expect(results[0]).toMatchObject({ ok: true, levelChanged: true });
		expect(results[1]).toEqual({ ok: false, reason: 'already_issued' });
		await issuedOnce(member.id);
	});

	it('the same level without an exam (old records) twice at once: issued once', async () => {
		const member = await db.member({ level: 'novice' });
		const input = { userId: member.id, kind: 'level' as const, level: 'advanced' as const };
		const results = await both({ ...input, comment: 'Transfer of 2019 records' });
		expect(results[0]).toMatchObject({ ok: true, levelChanged: true });
		expect(results[1]).toEqual({ ok: false, reason: 'already_issued' });
		await issuedOnce(member.id);
	});

	it('revoked twice at once: revoked once with the first reason, one log entry', async () => {
		const member = await db.member({ level: 'novice' });
		const [a, b] = await admins();
		const exam = await passedExam(db.main, member.id);
		const issued = await issuer(db.main)(a, {
			userId: member.id,
			kind: 'level',
			level: 'advanced',
			examId: exam.id
		});
		if (!issued.ok) throw new Error(issued.reason);
		const revoke = (actor: typeof a, reason: string) => (tx: LimitDb) =>
			revokeCertificate(tx, actor, { certificateId: issued.id, reason }, IP);

		expect(await db.race(revoke(a, 'Typo in the name'), revoke(b, 'Wrong date'))).toEqual([
			'ok',
			'already_revoked'
		]);
		const [cert] = await certsOf(db.main, member.id);
		expect(cert).toMatchObject({ status: 'revoked', revokeReason: 'Typo in the name' });
		expect(await logged('certificate', issued.id, 'certificate.revoke')).toBe(1);
		expect(await levelOf(db.main, member.id)).toBe('advanced');
		expect(await ledgerOf(db.main, member.id)).toHaveLength(paysOnce);
	});
});
