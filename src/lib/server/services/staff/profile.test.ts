import { and, eq } from 'drizzle-orm';
import { afterAll, describe, expect, it } from 'vitest';
import type { LimitDb } from '../../auth/rate-limit';
import { staffProfiles } from '../../db/schema/certification';
import { users } from '../../db/schema/users';
import { testDb, testDbUrl } from '../../db/test-db';
import { revokeCertificate } from '../certificates/revoke';
import {
	IP,
	daysFrom,
	insertCertificate,
	insertStaff,
	issuer,
	passedExam
} from '../certificates/test-support';
import { auditFor } from '../memberships/test-support';
import { insertMember } from '../registrations/test-support';
import { deactivateLapsedStaff } from './profile';

/* docs/03 section 5: a coach or judge certificate creates or switches on the profile in the same
 * transaction; a revoke or the end of the term switches it off. A profile is not a role. */

const NOW = new Date();

describe.skipIf(!testDbUrl)('staff profiles follow certificates', () => {
	const { inRollback, close } = testDb();
	afterAll(close);

	const profileOf = async (tx: LimitDb, userId: string, kind: 'trainer' | 'judge') =>
		(
			await tx
				.select()
				.from(staffProfiles)
				.where(and(eq(staffProfiles.userId, userId), eq(staffProfiles.kind, kind)))
		)[0];

	async function issueStaff(
		tx: LimitDb,
		admin: Awaited<ReturnType<typeof insertStaff>>,
		userId: string,
		kind: 'trainer' | 'judge',
		category: string | null = null
	) {
		const exam = await passedExam(tx, userId, kind);
		const result = await issuer(tx)(admin, { userId, kind, category, examId: exam.id });
		if (!result.ok) throw new Error(result.reason);
		return result.id;
	}

	it('a coach certificate creates an active, not public profile; logged with the issue', async () => {
		await inRollback(async (tx) => {
			const member = await insertMember(tx);
			const admin = await insertStaff(tx, 'admin');
			const id = await issueStaff(tx, admin, member.id, 'trainer', 'Category 1');

			expect(await profileOf(tx, member.id, 'trainer')).toMatchObject({
				isActive: true,
				isPublic: false,
				category: 'Category 1'
			});
			expect(await profileOf(tx, member.id, 'judge')).toBeUndefined();
			const [entry] = await auditFor(tx, 'certificate', id);
			expect(entry.after).toMatchObject({ staffProfile: 'created' });
			const [user] = await tx.select({ role: users.role }).from(users).where(eq(users.id, member.id));
			expect(user.role).toBe('member');
		});
	});

	it('a judge certificate adds a second profile; a level certificate adds none', async () => {
		await inRollback(async (tx) => {
			const member = await insertMember(tx, { level: 'novice' });
			const admin = await insertStaff(tx, 'admin');
			await issueStaff(tx, admin, member.id, 'trainer');
			await issueStaff(tx, admin, member.id, 'judge');
			const exam = await passedExam(tx, member.id);
			const level = await issuer(tx)(admin, {
				userId: member.id,
				kind: 'level',
				level: 'advanced',
				examId: exam.id
			});
			expect(level.ok).toBe(true);
			if (!level.ok) return;

			const rows = await tx
				.select({ kind: staffProfiles.kind, isActive: staffProfiles.isActive })
				.from(staffProfiles)
				.where(eq(staffProfiles.userId, member.id));
			expect(rows.sort((a, b) => a.kind.localeCompare(b.kind))).toEqual([
				{ kind: 'judge', isActive: true },
				{ kind: 'trainer', isActive: true }
			]);
			const [entry] = await auditFor(tx, 'certificate', level.id);
			expect(entry.after).not.toHaveProperty('staffProfile');
		});
	});

	it('a revoke switches the profile off; a new certificate switches the same profile on', async () => {
		await inRollback(async (tx) => {
			const member = await insertMember(tx);
			const admin = await insertStaff(tx, 'admin');
			const first = await issueStaff(tx, admin, member.id, 'trainer', 'Category 1');
			const profile = await profileOf(tx, member.id, 'trainer');
			await tx
				.update(staffProfiles)
				.set({ isPublic: true, category: 'Edited by admin' })
				.where(eq(staffProfiles.id, profile.id));

			const input = { certificateId: first, reason: 'Annulled' };
			expect(await revokeCertificate(tx, admin, input, IP, NOW)).toBe('ok');
			expect(await profileOf(tx, member.id, 'trainer')).toMatchObject({ isActive: false });
			const entries = await auditFor(tx, 'certificate', first);
			expect(entries[1].after).toMatchObject({ staffProfile: 'deactivated' });

			const second = await issueStaff(tx, admin, member.id, 'trainer', 'Category 2');
			expect(await profileOf(tx, member.id, 'trainer')).toMatchObject({
				id: profile.id,
				isActive: true,
				isPublic: true,
				category: 'Edited by admin'
			});
			const [issued] = await auditFor(tx, 'certificate', second);
			expect(issued.after).toMatchObject({ staffProfile: 'activated' });
		});
	});

	it('two live coach certificates: revoking one keeps the profile on', async () => {
		await inRollback(async (tx) => {
			const member = await insertMember(tx);
			const admin = await insertStaff(tx, 'admin');
			const old = await issueStaff(tx, admin, member.id, 'trainer');
			await issueStaff(tx, admin, member.id, 'trainer');

			const input = { certificateId: old, reason: 'Replaced' };
			expect(await revokeCertificate(tx, admin, input, IP, NOW)).toBe('ok');
			expect(await profileOf(tx, member.id, 'trainer')).toMatchObject({ isActive: true });
			const entries = await auditFor(tx, 'certificate', old);
			expect(entries[1].after).toMatchObject({ staffProfile: 'unchanged' });
		});
	});

	it('the expiry sweep switches off profiles whose certificate ended; logged as the system', async () => {
		await inRollback(async (tx) => {
			const admin = await insertStaff(tx, 'admin');
			const lapsed = await insertMember(tx);
			const valid = await insertMember(tx);
			const revoked = await insertMember(tx);
			for (const m of [lapsed, valid, revoked])
				await tx.insert(staffProfiles).values({ userId: m.id, kind: 'judge', isPublic: true });
			const base = { kind: 'judge' as const, issuedBy: admin.id, issuedAt: daysFrom(NOW, -800) };
			await insertCertificate(tx, { ...base, userId: lapsed.id, expiresAt: daysFrom(NOW, -1) });
			await insertCertificate(tx, { ...base, userId: valid.id, expiresAt: daysFrom(NOW, 30) });
			await insertCertificate(tx, {
				...base,
				userId: revoked.id,
				expiresAt: daysFrom(NOW, 30),
				status: 'revoked',
				revokedAt: NOW,
				revokeReason: 'Test'
			});

			expect(await deactivateLapsedStaff(tx, NOW)).toBeGreaterThanOrEqual(2);
			expect(await profileOf(tx, lapsed.id, 'judge')).toMatchObject({ isActive: false });
			expect(await profileOf(tx, revoked.id, 'judge')).toMatchObject({ isActive: false });
			expect(await profileOf(tx, valid.id, 'judge')).toMatchObject({ isActive: true });

			const profile = await profileOf(tx, lapsed.id, 'judge');
			const [entry] = await auditFor(tx, 'staff_profile', profile.id);
			expect(entry).toMatchObject({
				actorId: null,
				action: 'staff_profile.deactivate',
				after: { isActive: false, userId: lapsed.id, kind: 'judge' }
			});
			expect(await deactivateLapsedStaff(tx, NOW)).toBe(0);
		});
	});
});
