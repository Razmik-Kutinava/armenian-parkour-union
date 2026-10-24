import { and, eq, exists, gt, isNull, not, or, sql, type Column } from 'drizzle-orm';
import type { LimitDb } from '../../auth/rate-limit';
import { certificates, staffProfiles } from '../../db/schema/certification';
import { users } from '../../db/schema/users';
import { writeAudit } from '../audit';

/* docs/03 section 5: a profile is on while its owner holds a live certificate of the same kind —
 * created or switched on by the issue, switched off by a revoke or the end of the term. It gives
 * no role. `is_public` is the admin's (docs/04), never changed here. */

export type StaffKind = (typeof staffProfiles.$inferSelect)['kind'];
export type StaffChange = 'created' | 'activated' | 'deactivated' | 'unchanged';

/** As `certificateState`: active and not past `expires_at`, before the daily job (6.9) writes it. */
export const liveCertificateOf = (userId: Column | string, kind: Column | StaffKind, now: Date) =>
	and(
		eq(certificates.userId, userId),
		sql`${certificates.kind}::text = ${kind}::text`,
		eq(certificates.status, 'active'),
		or(isNull(certificates.expiresAt), gt(certificates.expiresAt, now))
	);

/**
 * Under the member row lock, so a revoke and a new issue for the same member cannot cross.
 * `category` fills a new profile, or an empty one being switched back on.
 */
export async function syncStaffProfile(
	tx: LimitDb,
	userId: string,
	kind: StaffKind,
	now: Date,
	category: string | null = null
): Promise<StaffChange> {
	await tx.select({ id: users.id }).from(users).where(eq(users.id, userId)).for('update');
	const [live] = await tx
		.select({ id: certificates.id })
		.from(certificates)
		.where(liveCertificateOf(userId, kind, now))
		.limit(1);
	const [profile] = await tx
		.select()
		.from(staffProfiles)
		.where(and(eq(staffProfiles.userId, userId), eq(staffProfiles.kind, kind)))
		.for('update');
	if (live) {
		if (!profile) {
			await tx.insert(staffProfiles).values({ userId, kind, category, isActive: true });
			return 'created';
		}
		if (profile.isActive) return 'unchanged';
		await tx
			.update(staffProfiles)
			.set({ isActive: true, category: profile.category ?? category })
			.where(eq(staffProfiles.id, profile.id));
		return 'activated';
	}
	if (!profile?.isActive) return 'unchanged';
	await tx.update(staffProfiles).set({ isActive: false }).where(eq(staffProfiles.id, profile.id));
	return 'deactivated';
}

/** For the daily job (6.9): profiles whose certificates ended; each in its own transaction. */
export async function deactivateLapsedStaff(db: LimitDb, now = new Date()): Promise<number> {
	const anyLive = db
		.select({ id: certificates.id })
		.from(certificates)
		.where(liveCertificateOf(staffProfiles.userId, staffProfiles.kind, now));
	const lapsed = await db
		.select({ id: staffProfiles.id, userId: staffProfiles.userId, kind: staffProfiles.kind })
		.from(staffProfiles)
		.where(and(eq(staffProfiles.isActive, true), not(exists(anyLive))));
	let count = 0;
	for (const p of lapsed) {
		const change = await db.transaction(async (tx) => {
			const change = await syncStaffProfile(tx, p.userId, p.kind, now);
			if (change === 'deactivated')
				await writeAudit(tx, {
					actorId: null,
					action: 'staff_profile.deactivate',
					entityType: 'staff_profile',
					entityId: p.id,
					before: { isActive: true },
					after: { isActive: false, userId: p.userId, kind: p.kind },
					ip: null
				});
			return change;
		});
		if (change === 'deactivated') count++;
	}
	return count;
}
